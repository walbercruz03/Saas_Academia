const express = require('express');
const autenticado = require('../middlewares/authMiddleware');
const administrador = require('../middlewares/isAdminMiddleware');
const { consulta } = require('../models/SuperAdmin');
const comercial = require('../models/ComercialWcFit');
const autogestao = require('../services/autogestaoComercial');
const permissoes = require('../services/permissoesProfessor');
const { transacao } = require('../models/SuperAdmin');
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

router.get('/dados', consultar(async (_req, res, academiaId) => {
  const { rows: [dados] } = await consulta(`
    SELECT a.nome, a.nome_fantasia, a.razao_social, a.tipo_cadastro, a.telefone, a.email, a.endereco,
      a.cep, a.logradouro, a.numero_endereco, a.complemento, a.bairro, a.cidade, a.uf,
      CASE WHEN coalesce(a.documento_cadastro, a.cnpj) IS NOT NULL
        THEN '••••' || right(regexp_replace(coalesce(a.documento_cadastro, a.cnpj), '[^A-Z0-9]', '', 'gi'), 4)
      END AS documento_mascarado
    FROM academias a WHERE a.id = $1
  `, [academiaId]);
  return dados ? res.json(dados) : res.status(404).json({ mensagem: 'Academia não encontrada.' });
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
