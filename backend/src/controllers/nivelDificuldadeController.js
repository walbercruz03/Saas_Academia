const NivelDificuldade = require('../models/NivelDificuldade');

const nivelDificuldadeController = {
  listar(req, res) {
    const { apenas_ativos = '' } = req.query;
    NivelDificuldade.listar(
      {
        apenasAtivos: apenas_ativos === '1' || apenas_ativos === 'true',
      },
      (err, rows) => {
        if (err) {
          console.error('Erro ao listar níveis de dificuldade:', err.message);
          return res.status(500).json({ erro: 'Erro ao listar níveis de dificuldade.' });
        }
        res.json(rows || []);
      }
    );
  },

  buscarPorId(req, res) {
    const { id } = req.params;
    NivelDificuldade.buscarPorId(id, (err, nivel) => {
      if (err) {
        console.error('Erro ao buscar nível de dificuldade:', err.message);
        return res.status(500).json({ erro: 'Erro ao buscar nível de dificuldade.' });
      }
      if (!nivel) {
        return res.status(404).json({ erro: 'Nível de dificuldade não encontrado.' });
      }
      res.json(nivel);
    });
  },

  criar(req, res) {
    const { nome, slug, ordem = 1, ativo = 1 } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do nível de dificuldade é obrigatório.' });
    }

    NivelDificuldade.criar({ nome, slug, ordem, ativo }, (err, criado) => {
      if (err) {
        if (err.message && /unique/i.test(err.message)) {
          return res.status(400).json({ erro: 'Já existe um nível com este nome ou identificador (slug).' });
        }
        console.error('Erro ao criar nível de dificuldade:', err.message);
        return res.status(500).json({ erro: 'Erro ao criar nível de dificuldade.' });
      }
      res.status(201).json(criado);
    });
  },

  atualizar(req, res) {
    const { id } = req.params;
    const { nome, slug, ordem = 1, ativo = 1 } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do nível de dificuldade é obrigatório.' });
    }

    NivelDificuldade.atualizar(id, { nome, slug, ordem, ativo }, (err, atualizado) => {
      if (err) {
        if (err.message && /unique/i.test(err.message)) {
          return res.status(400).json({ erro: 'Já existe um nível com este nome ou identificador (slug).' });
        }
        console.error('Erro ao atualizar nível de dificuldade:', err.message);
        return res.status(500).json({ erro: 'Erro ao atualizar nível de dificuldade.' });
      }
      res.json(atualizado);
    });
  },

  deletar(req, res) {
    const { id } = req.params;
    NivelDificuldade.deletar(id, (err) => {
      if (err) {
        if (err.status === 400) {
          return res.status(400).json({ erro: err.message });
        }
        console.error('Erro ao excluir nível de dificuldade:', err.message);
        return res.status(500).json({ erro: 'Erro ao excluir nível de dificuldade.' });
      }
      res.json({ mensagem: 'Nível de dificuldade excluído com sucesso.' });
    });
  },
};

module.exports = nivelDificuldadeController;
