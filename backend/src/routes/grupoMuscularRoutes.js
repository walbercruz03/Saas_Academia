const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const grupoMuscularController = require('../controllers/grupoMuscularController');

router.get('/', authMiddleware, grupoMuscularController.listar);
router.get('/:id', authMiddleware, grupoMuscularController.buscarPorId);
router.post('/', authMiddleware, grupoMuscularController.criar);
router.put('/:id', authMiddleware, grupoMuscularController.atualizar);
router.delete('/:id', authMiddleware, grupoMuscularController.deletar);

module.exports = router;