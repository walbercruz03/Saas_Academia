const modelo = require('../models/SuperAdmin');
const comercial = require('../models/ComercialWcFit');
const asaasConciliacao = require('../services/asaasConciliacao');
const seguranca = require('../services/superAdminSeguranca');
const sessoes = require('../models/SessaoUsuario');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');

const COOKIE = 'wcfit_super_admin';
const opcoesCookie = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict', path: '/api/super-admin',
};
const negar = (res) => res.status(401).json({ mensagem: 'Autenticação administrativa inválida ou expirada.' });

const permiteSemTotpLocal = (req) => process.env.SUPER_ADMIN_SEM_TOTP_LOCAL === 'true' &&
  process.env.SUPER_ADMIN_ORIGEM_LOCAL === 'http://localhost' && !process.env.APP_CORS_ORIGIN &&
  req.get('Host') === 'localhost' && [undefined, 'http://localhost'].includes(req.get('Origin'));

function tokenDaRequisicao(req) {
  const valor = req.headers.cookie?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return seguranca.hashSessao(valor);
}

function enviarSessao(res, sessao, extra = {}) {
  res.cookie(COOKIE, sessao.token, { ...opcoesCookie, maxAge: sessao.segundos * 1000 });
  return res.json({ etapa: sessao.etapa, ...extra });
}

async function credenciais(req, res) {
  if (!await modelo.limitar('credenciais', 8)) {
    res.status(429).json({ mensagem: 'Aguarde antes de tentar novamente.' });
    return null;
  }
  const { email, senha } = req.body || {};
  const { rows: [proprietario] } = await modelo.consulta(
    'SELECT id, senha_hash, totp_cifrado, ativo FROM super_admin_identidade WHERE email = $1',
    [seguranca.emailNormalizado(email)]);
  const valida = await seguranca.conferirSenha(senha, proprietario?.senha_hash);
  await modelo.auditar(valida && proprietario.ativo ? 'senha_validada' : 'autenticacao_recusada', proprietario?.id);
  if (!valida || !proprietario.ativo) {
    negar(res);
    return null;
  }
  return proprietario;
}

async function login(req, res) {
  const proprietario = await credenciais(req, res);
  if (!proprietario) return;
  const semTotpLocal = permiteSemTotpLocal(req) && await sessoes.disponivel();
  if (!semTotpLocal) await seguranca.prepararTotp();
  const sessao = await modelo.transacao(async (client) => {
    const { rows: [atual] } = await client.query(
      'SELECT totp_cifrado FROM super_admin_identidade WHERE id = $1 AND ativo FOR UPDATE',
      [proprietario.id]);
    if (!atual) return null;
    // Um novo desafio substitui o desafio anterior deste navegador.
    await client.query("DELETE FROM super_admin_sessoes WHERE token_hash = $1 AND etapa <> 'autenticada'",
      [tokenDaRequisicao(req)]);
    if (semTotpLocal) await modelo.auditar('autenticacao_local_sem_totp',proprietario.id,client);
    const etapa = semTotpLocal ? 'autenticada' : atual.totp_cifrado ? 'validar' : 'configurar';
    return modelo.emitirSessao(client, etapa);
  });
  return sessao ? enviarSessao(res, sessao) : negar(res);
}

async function exigirEtapa(req, res, next, etapas) {
  const tokenHash = tokenDaRequisicao(req);
  const sessao = tokenHash ? await modelo.buscarSessao(tokenHash) : null;
  const semTotpLocal = permiteSemTotpLocal(req);
  if (!sessao || !etapas.includes(sessao.etapa) ||
      (sessao.etapa === 'autenticada' && sessao.totp_confirmado_em === null && !semTotpLocal)) {
    if (await modelo.limitar('auditoria_acesso_recusado', 12)) {
      await modelo.auditar('acesso_administrativo_recusado', sessao?.proprietario_id);
    }
    return negar(res);
  }
  req.superAdmin = { tokenHash, etapa: sessao.etapa, expiraEm: sessao.expira_em, semTotpLocal };
  next();
}

async function configurar(req, res) {
  const totp = await seguranca.obterTotp();
  const segredo = await modelo.transacao(async (client) => {
    const sessao = await modelo.buscarSessao(req.superAdmin.tokenHash, client, true);
    if (sessao?.etapa !== 'configurar') return null;
    if (sessao.totp_pendente) return seguranca.decifrar(sessao.totp_pendente);
    const novo = totp.generateSecret();
    await client.query('UPDATE super_admin_sessoes SET totp_pendente = $1 WHERE token_hash = $2',
      [seguranca.cifrar(novo), req.superAdmin.tokenHash]);
    await modelo.auditar('configuracao_totp_iniciada', 1, client);
    return novo;
  });
  return segredo ? res.json({ segredo }) : negar(res);
}

async function validar(req, res) {
  if (!await modelo.limitar('totp', 8)) {
    return res.status(429).json({ mensagem: 'Aguarde antes de tentar novamente.' });
  }
  const resultado = await modelo.transacao(async (client) => {
    const sessao = await modelo.buscarSessao(req.superAdmin.tokenHash, client, true);
    if (!sessao || !['configurar', 'validar'].includes(sessao.etapa)) return null;
    const configurando = sessao.etapa === 'configurar';
    const cifrado = configurando ? sessao.totp_pendente : sessao.totp_cifrado;
    if (!cifrado) return null;
    const passo = await seguranca.conferirTotp(seguranca.decifrar(cifrado), req.body?.codigo);
    if (passo === null || (!configurando && sessao.ultimo_passo_totp !== null &&
        passo <= Number(sessao.ultimo_passo_totp))) {
      await modelo.auditar('totp_recusado', 1, client);
      return null;
    }
    let codigos;
    if (configurando) {
      codigos = seguranca.codigosRecuperacao();
      await client.query('DELETE FROM super_admin_recuperacao WHERE proprietario_id = 1');
      await client.query(`INSERT INTO super_admin_recuperacao (codigo_hash, proprietario_id)
        SELECT unnest($1::text[]), 1`, [codigos.map(seguranca.hashRecuperacao)]);
      await client.query('UPDATE super_admin_identidade SET totp_cifrado = $1, ultimo_passo_totp = $2 WHERE id = 1',
        [cifrado, passo]);
      await client.query('DELETE FROM super_admin_sessoes WHERE proprietario_id = 1');
      await modelo.auditar(sessao.totp_cifrado ? 'totp_alterado' : 'totp_configurado', 1, client);
    } else {
      await client.query('UPDATE super_admin_identidade SET ultimo_passo_totp = $1 WHERE id = 1', [passo]);
      await client.query('DELETE FROM super_admin_sessoes WHERE token_hash = $1', [req.superAdmin.tokenHash]);
    }
    await modelo.auditar('autenticacao_concluida', 1, client);
    return { sessao: await modelo.emitirSessao(client, 'autenticada', true), codigos };
  });
  return resultado ? enviarSessao(res, resultado.sessao, { codigos: resultado.codigos })
    : res.status(422).json({ mensagem: 'Código inválido, usado ou desafio expirado.' });
}

async function recuperar(req, res) {
  if (!await credenciais(req, res)) return;
  await seguranca.prepararTotp();
  const sessao = await modelo.transacao(async (client) => {
    const { rowCount: ativos } = await client.query(
      'SELECT id FROM super_admin_identidade WHERE id = 1 AND ativo FOR UPDATE');
    if (!ativos) return null;
    const { rowCount } = await client.query(`UPDATE super_admin_recuperacao SET usado_em = now()
      WHERE codigo_hash = $1 AND proprietario_id = 1 AND usado_em IS NULL`,
    [seguranca.hashRecuperacao(req.body?.codigo)]);
    if (!rowCount) {
      await modelo.auditar('recuperacao_recusada', 1, client);
      return null;
    }
    await client.query('DELETE FROM super_admin_sessoes WHERE proprietario_id = 1');
    await modelo.auditar('codigo_recuperacao_consumido', 1, client);
    await modelo.auditar('sessoes_revogadas_por_recuperacao', 1, client);
    return modelo.emitirSessao(client, 'configurar');
  });
  return sessao ? enviarSessao(res, sessao) : negar(res);
}

async function confirmarTotpRecente(req, res) {
  if (!await modelo.limitar('totp', 8)) {
    return res.status(429).json({ mensagem: 'Aguarde antes de tentar novamente.' });
  }
  const resultado = await modelo.transacao(async (client) => {
    const sessao = await modelo.buscarSessao(req.superAdmin.tokenHash, client, true);
    if (sessao?.etapa !== 'autenticada' || !sessao.totp_cifrado) return { expirou: true };
    const passo = await seguranca.conferirTotp(seguranca.decifrar(sessao.totp_cifrado), req.body?.codigo);
    if (passo === null || (sessao.ultimo_passo_totp !== null && passo <= Number(sessao.ultimo_passo_totp))) {
      await modelo.auditar('totp_recusado', sessao.proprietario_id, client);
      return null;
    }
    const token = seguranca.emitirToken();
    const { rows: [rotacionada] } = await client.query(`
      UPDATE super_admin_sessoes SET token_hash = $2, criado_em = clock_timestamp()
      WHERE token_hash = $1 AND expira_em > clock_timestamp()
      RETURNING GREATEST(0, FLOOR(EXTRACT(EPOCH FROM expira_em - clock_timestamp())))::integer AS segundos
    `, [req.superAdmin.tokenHash, seguranca.hashSessao(token)]);
    if (!rotacionada?.segundos) return { expirou: true };
    await modelo.marcarTotp(client,seguranca.hashSessao(token));
    await client.query('UPDATE super_admin_identidade SET ultimo_passo_totp = $1 WHERE id = $2', [passo, sessao.proprietario_id]);
    await modelo.auditar('totp_reconfirmado', sessao.proprietario_id, client);
    return { token, etapa: 'autenticada', segundos: rotacionada.segundos };
  });
  if (resultado?.expirou) return negar(res);
  return resultado ? enviarSessao(res, resultado)
    : res.status(422).json({ mensagem: 'Código inválido ou já usado. Use um novo código do autenticador.' });
}

const sessao = (req, res) => res.json({ etapa: req.superAdmin.etapa, expiraEm: req.superAdmin.expiraEm });

async function encerrar(req, res, todas = false) {
  await modelo.transacao(async (client) => {
    // Mesma ordem de bloqueio que as operações de segundo fator e recuperação.
    if (todas) await client.query('SELECT id FROM super_admin_identidade WHERE id = 1 FOR UPDATE');
    await client.query(todas ? 'DELETE FROM super_admin_sessoes WHERE proprietario_id = 1'
      : 'DELETE FROM super_admin_sessoes WHERE token_hash = $1', todas ? [] : [req.superAdmin.tokenHash]);
    await modelo.auditar(todas ? 'sessoes_revogadas' : 'sessao_encerrada', 1, client);
  });
  res.clearCookie(COOKIE, opcoesCookie);
  return res.status(204).end();
}

const dashboard = async (_req, res) => {
  const [dados, comerciais, sandbox] = await Promise.all([
    modelo.indicadores(), comercial.indicadores(), asaasConciliacao.indicadores(),
  ]);
  return res.json({ ...dados, comerciais, sandbox });
};

function paginar(consultar, academias = false) {
  return async (req, res) => {
    const origem = academias && req.method === 'POST' ? (req.body || {}) : req.query;
    const { pagina = '1', busca = '', situacao = '', cidade = '', uf = '', tipo = '', excluidas = '' } = origem;
    const documento = academias && req.method === 'POST' ? (origem.documento ?? '') : '';
    const documentoNormalizado = documento === '' ? '' :
      normalizarDocumento(documento, 'pessoa_fisica') || normalizarDocumento(documento, 'empresa');
    if (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina) ||
        typeof busca !== 'string' || busca.length > 120 ||
        !['', 'ativa', 'inativa'].includes(situacao) || (academias && (
          !['', '1'].includes(excluidas) || typeof cidade !== 'string' || cidade.length > 100 || typeof uf !== 'string' ||
          (uf && !/^[A-Z]{2}$/.test(uf)) || !['', 'mei', 'empresa', 'pessoa_fisica'].includes(tipo) ||
          documentoNormalizado === null))) {
      return res.status(400).json({ mensagem: 'Parâmetros de consulta inválidos.' });
    }
    const numero = Number(pagina);
    const tamanho = 20;
    if (academias) return res.json(await consultar({
      busca: busca.trim(), ativo: situacao ? situacao === 'ativa' : null, pagina: numero,
      cidade: cidade.trim(), uf, tipo, documento: documentoNormalizado, excluidas: excluidas === '1',
    }));
    const registros = await consultar({ limite: tamanho + 1, offset: (numero - 1) * tamanho });
    return res.json({ registros: registros.slice(0, tamanho), pagina: numero, temMais: registros.length > tamanho });
  };
}

async function cadastroAcademia(req, res) {
  const { id } = req.params;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id) > 2147483647) {
    return res.status(400).json({ mensagem: 'Academia inválida.' });
  }
  const dados = await modelo.obterCadastroAcademia(id);
  if (!dados) return res.status(404).json({ mensagem: 'Dados cadastrais indisponíveis.' });
  await modelo.auditar(`academia_cadastro_consultado:${id}`, 1);
  return res.json(dados);
}

async function administradores(req, res) {
  const { pagina = '1', busca = '', academia = '', excluidos = '0' } = req.query;
  const academiaInformada = req.params.id ?? academia;
  if (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina) ||
      !['0', '1'].includes(excluidos) || typeof busca !== 'string' || busca.length > 120 ||
      typeof academiaInformada !== 'string' ||
      (academiaInformada !== '' &&
        (!/^[1-9]\d{0,9}$/.test(academiaInformada) || Number(academiaInformada) > 2147483647))) {
    return res.status(400).json({ mensagem: 'Parâmetros de consulta inválidos.' });
  }
  const academiaId = academiaInformada ? Number(academiaInformada) : null;
  if (req.params.id && !await modelo.academiaExiste(academiaId)) {
    return res.status(404).json({ mensagem: 'Academia não encontrada.' });
  }
  return res.json(await modelo.listarAdministradores({
    busca: busca.trim(), academiaId, pagina: Number(pagina), excluidos: excluidos === '1',
  }));
}

async function cadastrarAcademia(req, res) {
  const corpo = req.body;
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) ||
      Object.keys(corpo).some((campo) => campo !== 'nome')) {
    return res.status(400).json({ mensagem: 'Informe apenas o nome da academia.' });
  }
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  if (!nome || nome.length > 160 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(nome)) {
    return res.status(400).json({ mensagem: 'Informe um nome válido de até 160 caracteres.' });
  }
  const chave = req.get('Idempotency-Key');
  if (!/^[a-f0-9]{32}$/.test(chave || '')) {
    return res.status(400).json({ mensagem: 'Chave da operação ausente ou inválida.' });
  }

  try {
    const resultado = await modelo.criarAcademia({ nome, chave, tokenHash: req.superAdmin.tokenHash });
    if (resultado.expirou) return negar(res);
    if (resultado.conflito) {
      return res.status(409).json({ mensagem: 'Esta operação já foi usada com outro nome.' });
    }
    return res.status(resultado.repetido ? 200 : 201).json(resultado.academia);
  } catch (erro) {
    if (erro.code === '23505' && erro.constraint === 'academias_nome_key') {
      return res.status(409).json({
        mensagem: 'O banco exige nomes únicos. Use o nome completo com uma identificação própria da unidade.',
      });
    }
    throw erro;
  }
}

module.exports = { login, exigirEtapa, configurar, validar, recuperar, confirmarTotpRecente, sessao, encerrar, dashboard, cadastrarAcademia, cadastroAcademia, administradores, academias: paginar(modelo.listarAcademias, true), auditoria: paginar(modelo.listarAuditoria) };
