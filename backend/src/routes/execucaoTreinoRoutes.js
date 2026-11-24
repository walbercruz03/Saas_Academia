const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const execucaoTreinoController = require('../controllers/execucaoTreinoController');

// Todas as rotas de acompanhamento de treinos exigem autenticação
router.use(authMiddleware);

router.get('/', execucaoTreinoController.listar);
router.post('/', execucaoTreinoController.criar);
router.delete('/:id', execucaoTreinoController.deletar);

module.exports = router;
