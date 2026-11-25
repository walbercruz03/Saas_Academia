const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const checkinController = require('../controllers/checkinController');

// Listar check-ins (auth - admin e professor)
router.get('/', authMiddleware, checkinController.listar);

// Buscar aluno por CPF para check-in (auth)
router.get('/buscar-aluno', authMiddleware, checkinController.buscarAluno);
router.get('/politica-inadimplencia', authMiddleware, isAdminMiddleware, checkinController.buscarPolitica);
router.put('/politica-inadimplencia', authMiddleware, isAdminMiddleware, checkinController.salvarPolitica);

require('./checkinFacial')(router,authMiddleware,isAdminMiddleware,checkinController);

// Realizar check-in (auth - admin e professor)
router.post('/', authMiddleware, checkinController.realizarCheckin);

module.exports = router;
