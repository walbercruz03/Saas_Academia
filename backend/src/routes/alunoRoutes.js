const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const alunoController = require('../controllers/alunoController');

// Listar alunos (auth - admin e professor)
router.get('/', authMiddleware, alunoController.listar);

// Buscar aluno por ID (auth)
router.get('/:id', authMiddleware, alunoController.findById);

// Criar aluno (auth - admin e professor)
router.post('/', authMiddleware, alunoController.create);

// Atualizar aluno (auth - admin e professor)
router.put('/:id', authMiddleware, alunoController.atualizar);

// Excluir aluno (apenas admin)
router.delete('/:id', authMiddleware, alunoController.excluir);

module.exports = router;
