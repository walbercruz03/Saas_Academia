const express = require('express');
const { autenticarWebhook, metadadosWebhook, criarApi } = require('../services/asaasSandbox');
const { exigirSchema } = require('../services/asaasComercial');
const { enfileirar } = require('../services/asaasConciliacao');

const router = express.Router();
router.post('/webhook', (req,res,next) => {
  if (!autenticarWebhook(req.get('asaas-access-token'))) return res.sendStatus(403);
  if (!req.is('application/json')) return res.sendStatus(415);
  next();
}, express.json({ limit:'256kb' }), async (req,res,next) => {
  try {
    if (['CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(req.body?.event)) {
      await require('../services/autogestaoComercial').recuperarCheckout(req.body,criarApi().namespace);
      if (req.body.event !== 'CHECKOUT_PAID') return res.status(200).end();
    }
    const evento = metadadosWebhook(req.body);
    if (evento) {
      const api = criarApi();
      await exigirSchema();
      await enfileirar(evento,api.namespace);
    }
    return res.status(200).end();
  } catch (erro) {
    return next(erro);
  }
});
router.use((erro,_req,res,_next) => {
  const status = [400,413].includes(erro.status) ? erro.status : 503;
  return res.status(status).json({ mensagem: 'Não foi possível registrar o evento Sandbox.' });
});

module.exports = router;
