const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const exercicioController = require('../controllers/exercicioController');

router.get('/', authMiddleware, exercicioController.listar);
router.get('/:id', authMiddleware, exercicioController.buscarPorId);
router.post('/', authMiddleware, exercicioController.criar);
router.put('/:id', authMiddleware, exercicioController.atualizar);
router.delete('/:id', authMiddleware, exercicioController.deletar);

module.exports = router;