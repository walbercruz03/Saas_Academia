const express = require('express');
const cadastro = require('../services/cadastroPublico');
const router = express.Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.use(express.json({ limit: '8kb' }));

const executar = (handler) => async (req, res, next) => {
  try {
    if (req.method === 'POST' && !req.is('application/json')) return res.sendStatus(415);
    await handler(req, res, await cadastro.configuracao());
  } catch (erro) {
    next(erro);
  }
};

router.get('/', executar((_req, res, config) =>
  res.json({ termos_url: config.termos, privacidade_url: config.privacidade,
    mensalidade_centavos: config.mensalidade, ...(config.autogestao && { aceite_comercial_obrigatorio: true }) })));

router.post('/email', executar(async (req, res, config) => {
  const email = cadastro.emailValido(req.body?.email);
  const desafio = await cadastro.solicitarCodigo(email, config);
  res.status(202).json({ desafio });
}));

router.post('/', executar(async (req, res, config) => {
  const dados = cadastro.validarCadastro(req.body || {}, config);
  await cadastro.concluirCadastro(dados, req.body?.desafio, req.body?.codigo, config);
  res.status(201).json({ mensagem: 'Cadastro concluído.' });
}));

router.use((erro, _req, res, _next) => {
  if (erro.code === '23505') return res.status(409).json({ mensagem: 'Não foi possível concluir o cadastro. Entre em contato com o suporte.' });
  if ([400, 403, 409, 422, 429].includes(erro.status) && !erro.type) {
    return res.status(erro.status).json({ mensagem: erro.message });
  }
  if (erro.type) return res.status(erro.status || 400).json({ mensagem: 'Dados de cadastro inválidos.' });
  return res.status(503).json({ mensagem: 'Cadastro público temporariamente indisponível.' });
});

module.exports = router;
