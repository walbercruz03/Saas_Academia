const express = require('express');
const router = express.Router();
const exercicioController = require('../controllers/exercicioController');

router.get('/', exercicioController.listar);
router.get('/:id', exercicioController.buscarPorId);
router.post('/', exercicioController.criar);
router.put('/:id', exercicioController.atualizar);
router.delete('/:id', exercicioController.deletar);

module.exports = router;