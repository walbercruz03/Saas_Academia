const express = require('express');
const router = express.Router();
const execucaoTreinoController = require('../controllers/execucaoTreinoController');

router.get('/', execucaoTreinoController.listar);
router.post('/', execucaoTreinoController.criar);
router.delete('/:id', execucaoTreinoController.deletar);

module.exports = router;