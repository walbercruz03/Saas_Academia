const express = require('express');
const router = express.Router();
const Treino = require('../models/Treino');

// Listar todos os treinos
router.get('/', (req, res) => {
  Treino.listarTodos((err, rows) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar treinos.' });
    }
    // Parseia o JSON dos exercícios armazenados no banco
    const treinosFormatados = rows.map(t => ({
      ...t,
      exercicios: JSON.parse(t.exercicios || '[]')
    }));
    res.json(treinosFormatados);
  });
});

// Criar nova ficha de treino
router.post('/', (req, res) => {
  const { aluno_id, divisao, exercicios } = req.body;

  if (!aluno_id || !divisao || !exercicios) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }

  Treino.criar(aluno_id, divisao, exercicios, (err, novoTreino) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao salvar treino no banco de dados.' });
    }
    res.status(201).json(novoTreino);
  });
});

// Deletar treino
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  Treino.deletar(id, (err) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao deletar treino.' });
    }
    res.json({ mensagem: 'Treino excluído com sucesso.' });
  });
});

module.exports = router;