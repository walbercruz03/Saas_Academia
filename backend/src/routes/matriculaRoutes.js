const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const matriculaController = require('../controllers/matriculaController');

// Listar matrículas (auth - admin e professor)
router.get('/', authMiddleware, matriculaController.listar);

// Buscar matrícula por ID (auth)
router.get('/:id', authMiddleware, matriculaController.findById);

// Criar matrícula (apenas admin)
router.post('/', authMiddleware, isAdminMiddleware, matriculaController.create);

// Atualizar matrícula (apenas admin)
router.put('/:id', authMiddleware, isAdminMiddleware, matriculaController.atualizar);

// Excluir matrícula (apenas admin)
router.delete('/:id', authMiddleware, isAdminMiddleware, matriculaController.excluir);

module.exports = router;
