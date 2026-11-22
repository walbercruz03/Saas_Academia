const express = require('express');
const router = express.Router();
const modeloTreinoController = require('../controllers/modeloTreinoController');

router.get('/', modeloTreinoController.listar);
router.get('/:id', modeloTreinoController.buscarPorId);
router.post('/', modeloTreinoController.criar);
router.post('/:id/duplicar', modeloTreinoController.duplicar);
router.put('/:id', modeloTreinoController.atualizar);
router.delete('/:id', modeloTreinoController.deletar);

module.exports = router;