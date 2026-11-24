const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const modalidadeController = require('../controllers/modalidadeController');

router.get('/', authMiddleware, modalidadeController.listar);
router.get('/:id', authMiddleware, modalidadeController.buscarPorId);
router.post('/', authMiddleware, modalidadeController.criar);
router.put('/:id', authMiddleware, modalidadeController.atualizar);
router.delete('/:id', authMiddleware, modalidadeController.deletar);

module.exports = router;
