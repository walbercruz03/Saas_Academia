const { createHash, createHmac, randomBytes } = require('node:crypto');
const { promisify } = require('node:util');
const bcrypt = require('bcryptjs');
const { consulta, transacao, limitar } = require('../models/SuperAdmin');
const { segredoJwt } = require('../middlewares/authMiddleware');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');
const { senhaValida } = require('./politicaSenha');
const { situacaoEfetiva } = require('../services/vigenciaMatricula');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');
const AlunoModeloTreino = require('../models/AlunoModeloTreino');
const logotipo = require('../models/LogotipoAcademia');

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const credenciaisInvalidas = () => erro(401, 'CPF, senha ou vínculo inválido.');
const codigoInvalido = () => erro(400, 'Código inválido ou expirado. Solicite um novo código à academia.');
const hash = (valor) => createHash('sha256').update(valor).digest('hex');
const segredo = () => randomBytes(32).toString('base64url');
const chaveValida = (valor) => typeof valor === 'string' && /^[\w-]{43}$/.test(valor);
const cpfNormalizado = (valor) => normalizarDocumento(valor, 'pessoa_fisica');
const validadeSessao = 8 * 60 * 60;
const expiraCodigoMinutos = 30;
const dummy = '$2a$12$VzzlH3Js7pTSxLGu.FwD4OdqkYaG0GmrZFMe9TNI70X.OmvgCFbU6';

const vinculo = `
  FROM aluno_portal_acessos p
  JOIN alunos al ON al.id=p.aluno_id AND al.academia_id=p.academia_id AND al.status <> 'inativo'
  JOIN academias a ON a.id=p.academia_id AND a.ativo=1 AND a.excluida_em IS NULL
`;

async function pronto() {
  const { rows:[schema] } = await consulta("SELECT to_regclass('public.aluno_portal_acessos') IS NOT NULL AS pronto");
  if (!schema.pronto) throw erro(503, 'Portal do Aluno indisponível neste ambiente.');
}

async function limitarTentativas(cpf, ip) {
  const chave = (valor) => createHmac('sha256', segredoJwt()).update(valor).digest('hex');
  if (!await limitar('portal-ip:' + chave(ip || 'local'), 240) ||
      (cpf && !await limitar('portal-cpf:' + chave(cpf), 12))) {
    throw erro(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  }
}

async function novaSessao(client, academia, aluno) {
  const token = segredo();
  await client.query('DELETE FROM aluno_portal_sessoes WHERE expira_em <= now()');
  await client.query(`
    INSERT INTO aluno_portal_sessoes (token_hash,academia_id,aluno_id,expira_em)
    VALUES ($1,$2,$3,now()+make_interval(secs => $4))
  `, [hash(token),academia,aluno,validadeSessao]);
  return token;
}

async function entrar(corpo, ip) {
  const cpf = cpfNormalizado(corpo.cpf);
  await limitarTentativas(cpf, ip);
  if (!cpf || typeof corpo.senha !== 'string' || !corpo.senha.length || Buffer.byteLength(corpo.senha) > 72 ||
      (corpo.academia_id != null && (!Number.isInteger(corpo.academia_id) || corpo.academia_id < 1 || corpo.academia_id > 2147483647))) {
    throw credenciaisInvalidas();
  }
  const { rows } = await consulta(`
    SELECT p.academia_id,p.aluno_id,p.senha_hash, coalesce(nullif(a.nome_fantasia,''),a.nome) AS nome
    ${vinculo}
    WHERE NOT p.bloqueado AND p.senha_hash IS NOT NULL
      AND length(regexp_replace(al.cpf, '[^0-9]', '', 'g'))=11
      AND regexp_replace(al.cpf, '[^0-9]', '', 'g')=$1
      AND ($2::integer IS NULL OR p.academia_id=$2)
    ORDER BY p.academia_id
  `, [cpf,corpo.academia_id ?? null]);
  if (!rows.length) await bcrypt.compare(corpo.senha,dummy);
  const validos = [];
  for (const cadastro of rows) {
    if (await bcrypt.compare(corpo.senha,cadastro.senha_hash)) validos.push(cadastro);
  }
  if (!validos.length) throw credenciaisInvalidas();
  if (validos.length > 1) return { academias: validos.map(({ academia_id, nome }) => ({ id: academia_id, nome })) };

  const [aluno] = validos;
  return transacao(async (client) => {
    const { rowCount } = await client.query(`
      SELECT p.aluno_id ${vinculo}
      WHERE p.academia_id=$1 AND p.aluno_id=$2 AND NOT p.bloqueado AND p.senha_hash=$3
        AND regexp_replace(al.cpf, '[^0-9]', '', 'g')=$4 FOR UPDATE OF p
    `, [aluno.academia_id,aluno.aluno_id,aluno.senha_hash,cpf]);
    if (!rowCount) throw credenciaisInvalidas();
    return { token: await novaSessao(client,aluno.academia_id,aluno.aluno_id) };
  });
}

async function ativar(corpo, ip) {
  const cpf = cpfNormalizado(corpo.cpf);
  await limitarTentativas(cpf, ip);
  if (!cpf || !chaveValida(corpo.codigo)) throw codigoInvalido();
  if (typeof corpo.senha !== 'string' || !senhaValida(corpo.senha) || Buffer.byteLength(corpo.senha) > 72) {
    throw erro(400,'Crie uma senha segura com pelo menos 8 caracteres e até 72 bytes.');
  }
  return transacao(async (client) => {
    const { rows:[aluno] } = await client.query(`
      SELECT p.academia_id,p.aluno_id ${vinculo}
      WHERE NOT p.bloqueado AND p.codigo_hash=$1 AND p.codigo_expira_em>now()
        AND regexp_replace(al.cpf, '[^0-9]', '', 'g')=$2 FOR UPDATE OF p
    `, [hash(corpo.codigo),cpf]);
    if (!aluno) throw codigoInvalido();
    await client.query(`
      UPDATE aluno_portal_acessos SET senha_hash=$3,codigo_hash=NULL,codigo_expira_em=NULL
      WHERE academia_id=$1 AND aluno_id=$2
    `, [aluno.academia_id,aluno.aluno_id,await bcrypt.hash(corpo.senha,12)]);
    await client.query('DELETE FROM aluno_portal_sessoes WHERE academia_id=$1 AND aluno_id=$2',[aluno.academia_id,aluno.aluno_id]);
    return { token: await novaSessao(client,aluno.academia_id,aluno.aluno_id) };
  });
}

async function sessao(token) {
  if (!chaveValida(token)) return null;
  const { rows:[aluno] } = await consulta(`
    SELECT p.academia_id,p.aluno_id ${vinculo}
    JOIN aluno_portal_sessoes s ON s.academia_id=p.academia_id AND s.aluno_id=p.aluno_id
    WHERE s.token_hash=$1 AND s.expira_em>now() AND NOT p.bloqueado AND p.senha_hash IS NOT NULL
  `, [hash(token)]);
  return aluno;
}

async function sair(token) {
  if (chaveValida(token)) await consulta('DELETE FROM aluno_portal_sessoes WHERE token_hash=$1',[hash(token)]);
}

async function alterarAcesso(academia, aluno, acao) {
  return transacao(async (client) => {
    const { rows:[cadastro] } = await client.query('SELECT cpf,status FROM alunos WHERE id=$1 AND academia_id=$2 FOR UPDATE',[aluno,academia]);
    if (!cadastro) throw erro(404,'Aluno não encontrado.');
    if (acao !== 'bloquear' && (!cpfNormalizado(cadastro.cpf) || cadastro.status === 'inativo')) {
      throw erro(409,'Ative o cadastro do aluno e confira se ele possui CPF válido.');
    }
    const bloqueado = acao === 'bloquear';
    const codigo = bloqueado ? null : segredo();
    await client.query(`
      INSERT INTO aluno_portal_acessos (academia_id,aluno_id,bloqueado,codigo_hash,codigo_expira_em)
      VALUES($1,$2,$3,$4,CASE WHEN $4::text IS NOT NULL THEN now()+make_interval(mins => $5) END)
      ON CONFLICT (academia_id,aluno_id) DO UPDATE SET bloqueado=EXCLUDED.bloqueado,senha_hash=NULL,
        codigo_hash=EXCLUDED.codigo_hash,codigo_expira_em=EXCLUDED.codigo_expira_em
    `, [academia,aluno,bloqueado,codigo && hash(codigo),expiraCodigoMinutos]);
    await client.query('DELETE FROM aluno_portal_sessoes WHERE academia_id=$1 AND aluno_id=$2',[academia,aluno]);
    return { codigo, expira_em_minutos: codigo ? expiraCodigoMinutos : null };
  });
}

async function estado(academia, aluno, usuario) {
  const { rows:[dados] } = await consulta(`
    SELECT coalesce(p.bloqueado,true) AS bloqueado, p.senha_hash IS NOT NULL AS ativo,
      p.codigo_expira_em>now() AS codigo_pendente, p.professor_id,p.objetivo,
      (to_jsonb(p)->>'meta_semanal')::int AS meta_semanal
    FROM alunos al LEFT JOIN aluno_portal_acessos p ON p.aluno_id=al.id AND p.academia_id=al.academia_id
    WHERE al.id=$1 AND al.academia_id=$2 AND ($3::integer IS NULL OR p.professor_id=$3)
  `, [aluno,academia,usuario.cargo === 'professor' ? usuario.id : null]);
  if (!dados) throw erro(404,'Aluno não encontrado.');
  if (usuario.cargo === 'professor') return { professor_id:dados.professor_id, objetivo:dados.objetivo, meta_semanal:dados.meta_semanal };
  const { rows:professores } = await consulta("SELECT id,nome FROM usuarios WHERE academia_id=$1 AND cargo='professor' AND status='ativo' ORDER BY nome,id",[academia]);
  return { ...dados, professores };
}

async function orientacao(academia, aluno, usuario, objetivo, professor) {
  if (usuario.cargo === 'professor') {
    const { rowCount } = await consulta(`
      UPDATE aluno_portal_acessos SET objetivo=$4
      WHERE academia_id=$1 AND aluno_id=$2 AND professor_id=$3
    `, [academia,aluno,usuario.id,objetivo]);
    if (!rowCount) throw erro(404,'Aluno não encontrado.');
    return;
  }
  const { rowCount } = await consulta(`
    INSERT INTO aluno_portal_acessos (academia_id,aluno_id,professor_id,objetivo)
    SELECT academia_id,id,$3,$4 FROM alunos WHERE id=$2 AND academia_id=$1
      AND ($3::integer IS NULL OR EXISTS (
        SELECT FROM usuarios WHERE id=$3 AND academia_id=$1 AND status='ativo' AND cargo='professor'))
    ON CONFLICT (academia_id,aluno_id) DO UPDATE SET professor_id=EXCLUDED.professor_id,objetivo=EXCLUDED.objetivo
  `, [academia,aluno,professor,objetivo]);
  if (!rowCount) throw erro(404,'Aluno ou professor não encontrado.');
}

function imagemHttps(valor) {
  if (typeof valor !== 'string' || valor.length > 2000) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

async function autorizarImagem(academia, exercicio, autorizada) {
  const { rows:[atual] } = await consulta(
    'SELECT imagem_url FROM exercicios WHERE id=$1 AND academia_id=$2',[exercicio,academia]);
  if (!atual) throw erro(404,'Exercício não encontrado nesta academia.');
  if (autorizada && !imagemHttps(atual.imagem_url)) throw erro(400,'Cadastre uma imagem HTTPS antes de autorizar a publicação.');
  const { rowCount } = await consulta(`
    UPDATE exercicios SET portal_imagem_autorizada=$3 WHERE id=$1 AND academia_id=$2
      AND imagem_url IS NOT DISTINCT FROM $4
  `, [exercicio,academia,autorizada ? atual.imagem_url : null,atual.imagem_url]);
  if (!rowCount) throw erro(409,'A imagem mudou. Atualize os dados antes de continuar.');
}

async function estadoImagem(academia, exercicio) {
  const { rows:[atual] } = await consulta(`
    SELECT coalesce(portal_imagem_autorizada=imagem_url,false) AS autorizada
    FROM exercicios WHERE id=$1 AND academia_id=$2
  `, [exercicio,academia]);
  if (!atual) throw erro(404,'Exercício não encontrado nesta academia.');
  return atual;
}

function exerciciosDaFicha(valor) {
  try {
    const itens = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return Array.isArray(itens) ? itens.filter((item) => item && typeof item === 'object') : [];
  } catch {
    return [];
  }
}

function texto(valor) {
  return ['string','number'].includes(typeof valor) ? String(valor) : '';
}

async function bibliotecaDasFichas(academia, prescricoes) {
  const exerciciosIds = [...new Set(prescricoes.flatMap((ficha) => ficha.exercicios.map((ex) => Number(ex.exercicio_id))))]
    .filter((id) => Number.isInteger(id) && id > 0 && id <= 2147483647);
  const { rows:biblioteca } = exerciciosIds.length ? await consulta(`
    SELECT id,nome,instrucoes,CASE WHEN portal_imagem_autorizada=imagem_url THEN imagem_url END AS imagem_url
    FROM exercicios WHERE id=ANY($2::integer[]) AND academia_id IN (0,$1)
  `,[academia,exerciciosIds]) : { rows:[] };
  return new Map(biblioteca.map((ex) => [ex.id,ex]));
}

async function fichasPrescritas(academia, aluno) {
  const [{ rows:fichas }, modelos] = await Promise.all([
    consulta(`
      SELECT t.id,t.divisao,t.exercicios FROM treinos t
      JOIN alunos al ON al.id=t.aluno_id AND al.academia_id=$1
      WHERE al.id=$2 AND (t.academia_id=$1 OR t.academia_id IS NULL)
      ORDER BY t.id DESC
    `,[academia,aluno]),
    promisify(AlunoModeloTreino.listarPorAluno)(aluno,academia),
  ]);
  const prescricoes = [
    ...fichas.map((ficha) => ({
      id: 'ficha-' + ficha.id, nome: ficha.divisao, descricao: '',
      exercicios: exerciciosDaFicha(ficha.exercicios),
    })),
    ...modelos.flatMap((modelo) => modelo.divisoes.map((divisao, indice) => ({
      id: 'modelo-' + modelo.vinculo_id + '-' + indice, nome: divisao.nome || modelo.nome,
      descricao: divisao.descricao || modelo.descricao, modelo: modelo.nome, exercicios: divisao.exercicios,
    }))),
  ];
  const porId = await bibliotecaDasFichas(academia,prescricoes);
  return prescricoes.map((ficha) => ({
    ...ficha,
    exercicios: ficha.exercicios.map((ex) => {
      const item = porId.get(Number(ex.exercicio_id));
      return {
        exercicio_id:item?.id ?? null,
        nome:texto(ex.nome || item?.nome) || 'Exercício', series:texto(ex.series),
        repeticoes:texto(ex.repeticoes), carga:texto(ex.carga), descanso:texto(ex.descanso),
        observacao:texto(ex.observacao || ex.observacoes), instrucoes:texto(item?.instrucoes),
        imagem_url:imagemHttps(item?.imagem_url),
      };
    }),
  }));
}

async function painel({ academia_id:academia, aluno_id:aluno }) {
  const { rows:[cadastro] } = await consulta(`
    SELECT al.nome, al.email, al.telefone, al.status, p.objetivo,
      coalesce(nullif(btrim(a.nome_fantasia),''),'Wc Fit') AS academia,
      u.nome AS professor
    ${vinculo}
    LEFT JOIN usuarios u ON u.id=p.professor_id AND u.academia_id=p.academia_id
      AND u.cargo='professor' AND u.status='ativo'
    WHERE p.academia_id=$1 AND p.aluno_id=$2 AND NOT p.bloqueado
  `, [academia,aluno]);
  if (!cadastro) throw credenciaisInvalidas();
  const [fichas, { rows:matriculas }, logoPronto] = await Promise.all([
    fichasPrescritas(academia,aluno),
    consulta(`
      SELECT m.id,m.data_inicio,m.data_vencimento,m.status,pl.nome AS plano, pl.id AS plano_valido
      FROM matriculas m JOIN planos pl ON pl.id=m.plano_id AND pl.academia_id=m.academia_id
      WHERE m.academia_id=$1 AND m.aluno_id=$2 ORDER BY m.data_inicio DESC,m.id DESC
    `,[academia,aluno]),
    logotipo.disponivel(),
  ]);

  const logo = logoPronto ? (await consulta(
    'SELECT md5(conteudo) AS versao FROM academia_logotipos WHERE academia_id=$1',[academia])).rows[0] : null;
  const hoje = getDataHojeFortaleza();
  return {
    nome:cadastro.nome, email:cadastro.email, telefone:cadastro.telefone, academia:cadastro.academia,
    professor:cadastro.professor, objetivo:cadastro.objetivo,
    logo_disponivel:Boolean(logo), logo_versao:logo?.versao ?? null,
    matriculas: matriculas.map(({ plano_valido,...m }) => ({
      id:m.id, plano:m.plano, data_inicio:m.data_inicio, data_vencimento:m.data_vencimento,
      situacao:situacaoEfetiva({ ...m, plano_valido, aluno_status:cadastro.status },hoje),
    })),
    fichas,
  };
}

module.exports = { pronto, entrar, ativar, sessao, sair, alterarAcesso, estado, orientacao,
  autorizarImagem, estadoImagem, painel, validadeSessao, fichasPrescritas, bibliotecaDasFichas, imagemHttps };
