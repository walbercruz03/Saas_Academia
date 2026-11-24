const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const nivelDificuldadeController = require('../controllers/nivelDificuldadeController');

router.get('/', authMiddleware, nivelDificuldadeController.listar);
router.get('/:id', authMiddleware, nivelDificuldadeController.buscarPorId);
router.post('/', authMiddleware, nivelDificuldadeController.criar);
router.put('/:id', authMiddleware, nivelDificuldadeController.atualizar);
router.delete('/:id', authMiddleware, nivelDificuldadeController.deletar);

module.exports = router;
