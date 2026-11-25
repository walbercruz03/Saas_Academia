const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const alunoController = require('../controllers/alunoController');

// Listar alunos (auth - admin e professor)
router.get('/', authMiddleware, alunoController.listar);

// Buscar aluno por ID (auth)
router.get('/:id', authMiddleware, alunoController.findById);

// Criar aluno (auth - admin e professor)
router.post('/', authMiddleware, alunoController.create);

// Atualizar aluno (auth - admin e professor)
router.put('/:id', authMiddleware, alunoController.atualizar);

// Modelos de treino associados ao aluno (auth - admin e professor)
router.get('/:id/modelos-treino', authMiddleware, alunoController.listarModelos);
router.post('/:id/modelos-treino', authMiddleware, alunoController.atribuirModelo);
router.delete('/:id/modelos-treino/:modeloId', authMiddleware, alunoController.desassociarModelo);

// Excluir aluno (apenas admin)
router.delete('/:id', authMiddleware, isAdminMiddleware, alunoController.excluir);

module.exports = router;
