const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const controller = require('../controllers/financeiroController');

router.use(authMiddleware);

router.get('/', controller.listarMovimentacoes);
router.post('/', controller.criarMovimentacao);
router.patch('/:id/baixar', controller.confirmarPagamento);
router.delete('/:id', isAdminMiddleware, controller.excluirMovimentacao);

module.exports = router;