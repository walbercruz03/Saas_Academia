const bcrypt = require('bcryptjs');
const convites = require('../models/SuperAdminConvite');
const { limitar } = require('../models/SuperAdmin');
const { emailNormalizado } = require('../services/superAdminSeguranca');
const { senhaValida, MENSAGEM_SENHA } = require('../services/politicaSenha');

const idValido = (valor) => typeof valor === 'string' && /^[1-9]\d{0,9}$/.test(valor) && Number(valor) <= 2147483647;
const somente = (dados, campos) => dados && typeof dados === 'object' && !Array.isArray(dados)
  && Object.keys(dados).every((campo) => campos.includes(campo));

function origemConvite() {
  try {
    const valor = process.env.SUPER_ADMIN_CONVITE_ORIGIN;
    const url = new URL(valor);
    const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const localConfigurado = process.env.SUPER_ADMIN_ORIGEM_LOCAL === 'http://localhost' && valor === 'http://localhost';
    if (url.origin === valor && (url.protocol === 'https:' || local || localConfigurado)) return url.origin;
  } catch {
    // A origem deve ser explicitamente configurada no servidor.
  }
  return null;
}

const mensagens = {
  401: 'Sessão administrativa inválida ou expirada.',
  404: 'Registro não encontrado.',
  409: 'Não foi possível concluir o convite com esses dados ou o registro já foi utilizado.',
  428: 'Confirme novamente o código do autenticador para continuar.',
};

async function emitir(req, res) {
  const { nome: texto, email: endereco } = req.body || {};
  const nome = typeof texto === 'string' ? texto.trim() : '';
  const email = emailNormalizado(endereco);
  const chave = req.get('Idempotency-Key');
  if (!idValido(req.params.id) || !somente(req.body, ['nome', 'email']) ||
      !nome || nome.length > 160 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(nome) ||
      email.length > 254 || !/^[^\s@\p{Cc}\p{Cf}]+@[^\s@\p{Cc}\p{Cf}]+\.[^\s@\p{Cc}\p{Cf}]+$/u.test(email) ||
      !/^[a-f0-9]{32}$/.test(chave || '')) {
    return res.status(400).json({ mensagem: 'Informe academia, nome e e-mail válidos.' });
  }
  const origem = origemConvite();
  if (!origem) return res.status(503).json({ mensagem: 'A origem de entrega do convite não está configurada.' });

  const { status, id, expiraEm, token } = await convites.emitir({
    tokenHash: req.superAdmin.tokenHash, semTotpLocal: req.superAdmin.semTotpLocal, academiaId: Number(req.params.id), nome, email, chave,
  });
  if (status !== 201 && status !== 200) return res.status(status).json({ mensagem: mensagens[status] });
  return res.status(status).json({ id, expiraEm, ...(token && { link: `${origem}/aceitar-convite#${token}` }) });
}

async function revogar(req, res) {
  if (!idValido(req.params.id) || !somente(req.body, [])) return res.status(400).json({ mensagem: 'Convite inválido.' });
  const { status } = await convites.revogar(Number(req.params.id), req.superAdmin.tokenHash, req.superAdmin.semTotpLocal);
  return status === 204 ? res.status(204).end() : res.status(status).json({ mensagem: mensagens[status] });
}

async function listar(req, res) {
  const { academia = '', pagina = '1' } = req.query;
  if ((academia !== '' && !idValido(academia)) || typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina)) {
    return res.status(400).json({ mensagem: 'Parâmetros de consulta inválidos.' });
  }
  return res.json(await convites.listar({ academiaId: academia ? Number(academia) : null, pagina: Number(pagina) }));
}

async function limpar(req, res) {
  const { id } = req.params;
  const { academia, confirmar } = req.body || {};
  if (confirmar !== true || !somente(req.body, id ? ['confirmar'] : ['confirmar', 'academia']) ||
      (id && !idValido(id)) || (academia !== undefined && !idValido(academia))) {
    return res.status(400).json({ mensagem: 'Confirme a exclusão e confira o filtro da academia.' });
  }
  const { status, removidos } = await convites.ocultarFinalizados({
    id: id ? Number(id) : null, academiaId: academia ? Number(academia) : null,
    tokenHash: req.superAdmin.tokenHash, semTotpLocal: req.superAdmin.semTotpLocal,
  });
  if (status === 200) return res.json({ removidos });
  return res.status(status).json({
    mensagem: status === 409 ? 'Somente convites finalizados podem ser excluídos da lista.' : mensagens[status],
  });
}

async function aceitar(req, res) {
  if (!await limitar('convite_publico', 12)) {
    return res.status(429).json({ mensagem: 'Aguarde antes de tentar novamente.' });
  }
  const { token, senha } = req.body || {};
  if (!somente(req.body, ['token', 'senha']) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return res.status(400).json({ mensagem: 'Convite indisponível.' });
  }
  if (!senhaValida(senha)) {
    return res.status(400).json({ mensagem: MENSAGEM_SENHA });
  }
  let aceito;
  try {
    aceito = await convites.aceitar(token, await bcrypt.hash(senha, 10));
  } catch (erro) {
    if (erro.code !== 'CONVITE_EXPIRADO' && erro.code !== '23505') throw erro;
  }
  if (!aceito) return res.status(400).json({ mensagem: 'Convite indisponível.' });
  return res.status(201).json({ mensagem: 'Senha definida. O acesso depende da situação operacional da academia.' });
}

module.exports = { emitir, revogar, listar, limpar, aceitar, origemConvite };
