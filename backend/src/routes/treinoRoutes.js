const express = require('express');
const router = express.Router();
router.use(require('../middlewares/authMiddleware'));
const Treino = require('../models/Treino');

// Listar todos os treinos
router.get('/', (req, res) => {
  Treino.listarTodos(req.usuario.academia_id, (err, rows) => {
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

  Treino.criar(aluno_id, divisao, exercicios, req.usuario.academia_id, (err, novoTreino) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao salvar treino no banco de dados.' });
    }
    if (!novoTreino) return res.status(404).json({ erro: 'Aluno não encontrado.' });
    res.status(201).json(novoTreino);
  });
});

// Deletar treino
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  Treino.deletar(id, req.usuario.academia_id, function (err) {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao deletar treino.' });
    }
    if (!this.changes) return res.status(404).json({ erro: 'Treino não encontrado.' });
    res.json({ mensagem: 'Treino excluído com sucesso.' });
  });
});

module.exports = router;