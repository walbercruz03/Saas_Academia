const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const modeloTreinoController = require('../controllers/modeloTreinoController');

router.get('/', authMiddleware, modeloTreinoController.listar);
router.get('/:id', authMiddleware, modeloTreinoController.buscarPorId);
router.post('/', authMiddleware, modeloTreinoController.criar);
router.post('/:id/duplicar', authMiddleware, modeloTreinoController.duplicar);
router.put('/:id', authMiddleware, modeloTreinoController.atualizar);
router.delete('/:id', authMiddleware, modeloTreinoController.deletar);

module.exports = router;
