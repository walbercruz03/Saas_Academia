const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const controller = require('../controllers/relatorioController');

router.use(authMiddleware);

// Rotas genéricas por tipo e período (ex: ?tipo=financeiro&periodo=este_mes ou personalizado)
router.get('/', controller.obterRelatorio);
router.get('/pdf', isAdminMiddleware, controller.gerarPDFRelatorio);

// Rotas específicas mantidas por compatibilidade
router.get('/geral/hoje', controller.obterRelatorioHoje);
router.get('/geral/hoje/pdf', isAdminMiddleware, controller.gerarPDFHoje);

module.exports = router;