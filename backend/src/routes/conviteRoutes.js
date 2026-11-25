const express = require('express');
const { aceitar } = require('../controllers/superAdminConviteController');
const router = express.Router();

router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  if (req.method === 'POST' && !req.is('application/json')) return res.sendStatus(415);
  next();
});
router.use(express.json({ limit: '4kb' }));
router.post('/aceitar', (req, res, next) => aceitar(req, res).catch(next));
router.use((erro, _req, res, _next) => res.status([400, 413].includes(erro.status) ? erro.status : 503)
  .json({ mensagem: 'Não foi possível processar o convite.' }));

module.exports = router;
