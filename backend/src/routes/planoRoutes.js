const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const planoController = require('../controllers/planoController');

// Listar planos (auth - admin e professor)
router.get('/', authMiddleware, planoController.listar);

// Buscar plano por ID (auth)
router.get('/:id', authMiddleware, planoController.findById);

// Criar plano (apenas admin)
router.post('/', authMiddleware, isAdminMiddleware, planoController.create);

// Atualizar plano (apenas admin)
router.put('/:id', authMiddleware, isAdminMiddleware, planoController.atualizar);

// Excluir plano (apenas admin)
router.delete('/:id', authMiddleware, isAdminMiddleware, planoController.excluir);

module.exports = router;
