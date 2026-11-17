const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const checkinController = require('../controllers/checkinController');

// Listar check-ins (auth - admin e professor)
router.get('/', authMiddleware, checkinController.listar);

// Buscar aluno por CPF para check-in (auth)
router.get('/buscar-aluno', authMiddleware, checkinController.buscarAluno);

// Realizar check-in (auth - admin e professor)
router.post('/', authMiddleware, checkinController.realizarCheckin);

module.exports = router;
