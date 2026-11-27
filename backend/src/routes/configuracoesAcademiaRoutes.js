const express = require('express');
const autenticado = require('../middlewares/authMiddleware');
const administrador = require('../middlewares/isAdminMiddleware');
const { consulta, transacao } = require('../models/SuperAdmin');
const comercial = require('../models/ComercialWcFit');
const autogestao = require('../services/autogestaoComercial');
const permissoes = require('../services/permissoesProfessor');
const logotipo = require('../models/LogotipoAcademia');
const onboarding = require('../models/OnboardingAcademia');
const { emailValido, validarEnderecoAcademia, validarNomeFantasia, validarRazaoSocial,
  validarTelefoneComercial } = require('../services/cadastroPublico');
const logFalha = require('../utils/logFalha');

const router = express.Router();
router.use(autenticado, administrador, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function consultar(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res, req.usuario.academia_id);
    } catch (falha) {
      if ([400,403,409,502,503].includes(falha.status)) return res.status(falha.status).json({ mensagem: falha.message });
      if (falha.status === 404) return res.status(404).json({ mensagem: 'Academia não encontrada.' });
      logFalha('Falha ao consultar configurações da academia', falha);
      return res.status(503).json({ mensagem: 'Configurações temporariamente indisponíveis.' });
    }
  };
}

router.get('/onboarding', consultar(async (_req, res, academiaId) => {
  const dados = await onboarding.consultar(academiaId);
  return dados ? res.json(dados) : res.status(404).json({ mensagem: 'Academia não encontrada.' });
}));

router.put('/dados', consultar(async (req, res, academiaId) => {
  const corpo = req.body || {};
  const validar = (campo, validador) => Object.hasOwn(corpo, campo) ? validador(corpo[campo]) : null;
  const fantasia = validar('nome_fantasia', validarNomeFantasia);
  const razao = validar('razao_social', validarRazaoSocial);
  const telefone = validar('whatsapp_comercial', validarTelefoneComercial);
  const email = validar('email', emailValido);
  const endereco = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']
    .some((campo) => Object.hasOwn(corpo, campo)) ? validarEnderecoAcademia(corpo) : null;
  if (!fantasia && !razao && !telefone && !email && !endereco) {
    return res.status(400).json({ mensagem: 'Informe os dados comerciais a atualizar.' });
  }
  const enderecoCompleto = endereco
    ? `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}/${endereco.uf}` : null;

  try {
    const atualizado = await transacao(async (client) => {
      const { rows: [academia] } = await client.query(
        'SELECT tipo_cadastro FROM academias WHERE id=$1 AND ativo=1 AND excluida_em IS NULL FOR UPDATE', [academiaId]);
      if (!academia) return false;
      if (razao && academia.tipo_cadastro === 'pessoa_fisica') {
        throw Object.assign(new Error('Razão social está disponível para cadastros de pessoa jurídica.'), { status: 400 });
      }
      await client.query(`
        UPDATE academias SET nome=coalesce($1,nome), nome_fantasia=coalesce($1,nome_fantasia),
          razao_social=coalesce($2,razao_social), telefone=coalesce($3,telefone), email=coalesce($4,email),
          email_responsavel_verificado_em=CASE WHEN $4 IS NULL OR email=$4 THEN email_responsavel_verificado_em END,
          endereco=coalesce($5,endereco), cep=coalesce($6,cep), logradouro=coalesce($7,logradouro),
          numero_endereco=coalesce($8,numero_endereco), complemento=CASE WHEN $5 IS NULL THEN complemento ELSE $9 END,
          bairro=coalesce($10,bairro), cidade=coalesce($11,cidade), uf=coalesce($12,uf),
          unidade_cadastro=CASE WHEN documento_cadastro IS NOT NULL THEN coalesce($13,unidade_cadastro)
            ELSE unidade_cadastro END
        WHERE id=$14
      `, [fantasia, razao, telefone, email, enderecoCompleto, endereco?.cep, endereco?.logradouro, endereco?.numero,
        endereco?.complemento || null, endereco?.bairro, endereco?.cidade, endereco?.uf, endereco?.unidade, academiaId]);
      return true;
    });
    return atualizado ? res.status(204).end() : res.status(404).json({ mensagem: 'Academia não encontrada.' });
  } catch (erro) {
    if (erro.code === '23505' && erro.constraint === 'academias_documento_unidade_cadastro_key') {
      return res.status(409).json({ mensagem: 'Já existe uma unidade deste documento com o endereço informado.' });
    }
    throw erro;
  }
}));

router.get('/dados/logotipo', consultar(async (_req, res, academiaId) => {
  if (!await logotipo.disponivel()) return res.status(503).end();
  const imagem = await logotipo.buscar(academiaId);
  if (!imagem) return res.status(404).end();
  return res.set('X-Content-Type-Options', 'nosniff').type(imagem.mime).send(Buffer.from(imagem.conteudo));
}));

router.put('/dados/logotipo',
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: logotipo.limite, inflate: false }),
  consultar(async (req, res, academiaId) => {
    const mime = req.is(['image/png', 'image/jpeg', 'image/webp']);
    if (!logotipo.formatoValido(mime, req.body)) {
      return res.status(400).json({ mensagem: 'Envie um logotipo PNG, JPEG ou WebP de até 128 KiB.' });
    }
    if (!await logotipo.disponivel()) {
      return res.status(503).json({ mensagem: 'O envio de logotipo ainda está indisponível.' });
    }
    return await logotipo.salvar(academiaId, mime, req.body)
      ? res.status(204).end()
      : res.status(404).json({ mensagem: 'Academia não encontrada.' });
  }),
  (erro, _req, res, next) => {
    if (erro.type === 'entity.too.large') return res.status(413).json({ mensagem: 'O logotipo deve ter até 128 KiB.' });
    if (erro.type === 'encoding.unsupported') return res.status(415).json({ mensagem: 'Envie o arquivo sem compactação HTTP.' });
    return next(erro);
  }
);

router.get('/dados', consultar(async (_req, res, academiaId) => {
  const { rows: [dados] } = await consulta(`
    SELECT a.nome, a.nome_fantasia, a.razao_social, a.tipo_cadastro, a.telefone, a.email, a.endereco,
      a.cep, a.logradouro, a.numero_endereco, a.complemento, a.bairro, a.cidade, a.uf,
      CASE WHEN coalesce(a.documento_cadastro, a.cnpj) IS NOT NULL
        THEN '••••' || right(regexp_replace(coalesce(a.documento_cadastro, a.cnpj), '[^A-Z0-9]', '', 'gi'), 4)
      END AS documento_mascarado
    FROM academias a WHERE a.id = $1
  `, [academiaId]);
  if (!dados) return res.status(404).json({ mensagem: 'Academia não encontrada.' });
  const logotipoDisponivel = await logotipo.disponivel();
  return res.json({
    ...dados, logotipo_disponivel: logotipoDisponivel,
    portal_aluno_caminho: `/aluno/login?academia=${academiaId}`,
  });
}));

router.get('/assinatura', consultar(async (req, res, academiaId) => {
  const { pagina = '1' } = req.query;
  if (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina)) {
    return res.status(400).json({ mensagem: 'Página inválida.' });
  }
  const dados = await comercial.detalhes(academiaId, Number(pagina));
  const { situacao, mensalidade_centavos, fim_teste, proximo_vencimento, cortesia_ate } = dados.academia;
  const dias = fim_teste ? Math.max(0, (Date.parse(fim_teste) - Date.parse(dados.hoje)) / 86400000) : null;
  const operacao = await autogestao.estado(academiaId);
  return res.json({
    autogestao: operacao, sandbox: process.env.ASAAS_SANDBOX_ATIVO === 'true',
    plano: mensalidade_centavos == null ? null : 'WC Fit Mensal',
    situacao, mensalidade_centavos, fim_teste, proximo_vencimento, cortesia_ate, dias_gratuitos: dias,
    pagina: dados.pagina, temMais: dados.temMaisRecebimentos,
    pagamentos: dados.recebimentos.map(({ id, competencia, recebido_em, valor_centavos }) =>
      ({ id, competencia, recebido_em, valor_centavos })),
  });
}));

const ator = (req) => ({ usuarioId:req.usuario.id, academiaId:req.usuario.academia_id });

router.get('/assinatura/sandbox', consultar(async (req,res,id) => {
  const { pagina = '1' } = req.query;
  if (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina)) {
    return res.status(400).json({ mensagem:'Página inválida.' });
  }
  return res.json(await require('../services/asaasConciliacao').consultarCobrancas(id,Number(pagina)));
}));

router.post('/assinatura/contratar', consultar(async (req,res,id) => {
  const { meio, preco, documento, confirmar, trocar } = req.body || {};
  if (!['PIX','CREDIT_CARD'].includes(meio) || !Number.isSafeInteger(preco) || preco <= 0 || confirmar !== true ||
      (trocar != null && typeof trocar !== 'boolean') || (documento != null && (typeof documento !== 'string' || documento.length > 18))) {
    return res.status(400).json({ mensagem:'Confira e confirme a forma de pagamento e o valor.' });
  }
  return res.json(await autogestao.contratar(ator(req),id,{ meio, preco, documento, trocar }));
}));

router.post('/assinatura/cancelar', consultar(async (req,res,id) => {
  if (req.body?.confirmar !== true) return res.status(400).json({ mensagem:'Confirme o cancelamento.' });
  return res.json(await autogestao.cancelar(ator(req),id));
}));

router.get('/permissoes', consultar(async (_req, res, academiaId) => {
  if (!await permissoes.disponivel()) return res.status(503).json({ mensagem: 'A gestão de permissões requer a migration 016.' });
  const { rows: professores } = await consulta(`
    SELECT u.id,u.nome,p.permissoes FROM usuarios u LEFT JOIN professor_permissoes p
      ON p.usuario_id=u.id AND p.academia_id=u.academia_id
    WHERE u.academia_id=$1 AND u.cargo='professor' ORDER BY u.nome,u.id`, [academiaId]);
  return res.json({ professores, modulos: permissoes.modulos, acoes: permissoes.porModulo });
}));

router.put('/permissoes/:id', consultar(async (req,res,academiaId) => {
  const id = req.params.id;
  const regras = req.body?.permissoes;
  if (!/^[1-9]\d{0,9}$/.test(id) || Number(id)>2147483647 || !permissoes.validar(regras)) {
    return res.status(400).json({ mensagem: 'Confira o professor e as permissões.' });
  }
  if (!await permissoes.disponivel()) return res.status(503).json({ mensagem: 'A gestão de permissões requer a migration 016.' });
  const guardado = await transacao(async (client) => {
    const { rowCount } = await client.query(`
      SELECT 1 FROM usuarios WHERE id=$1 AND academia_id=$2 AND cargo='professor' FOR UPDATE`, [id,academiaId]);
    if (!rowCount) return false;
    await client.query(`
      INSERT INTO professor_permissoes(usuario_id,academia_id,permissoes,alterado_por)
      VALUES($1,$2,$3,$4) ON CONFLICT(usuario_id) DO UPDATE SET permissoes=EXCLUDED.permissoes,
        alterado_por=EXCLUDED.alterado_por,atualizado_em=clock_timestamp()
      WHERE professor_permissoes.academia_id=EXCLUDED.academia_id`, [id,academiaId,regras,req.usuario.id]);
    return true;
  });
  return guardado ? res.status(204).end() : res.status(404).json({ mensagem: 'Professor não encontrado.' });
}));

module.exports = router;
