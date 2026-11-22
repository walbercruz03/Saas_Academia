const express = require('express');
const router = express.Router();
const grupoMuscularController = require('../controllers/grupoMuscularController');

// Se o seu projeto aplicar authMiddleware globalmente no app.js, mantém direto;
// caso contrário, importe e aplique seu middleware JWT e de perfil ('admin', 'professor').
router.get('/', grupoMuscularController.listar);
router.get('/:id', grupoMuscularController.buscarPorId);
router.post('/', grupoMuscularController.criar);
router.put('/:id', grupoMuscularController.atualizar);
router.delete('/:id', grupoMuscularController.deletar);

module.exports = router;