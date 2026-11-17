const Plano = require('../models/Plano');

const planoController = {
  listar(req, res) {
    Plano.listar((err, planos) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar planos.' });
      res.json(planos);
    });
  },

  findById(req, res) {
    Plano.findById(req.params.id, (err, plano) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar plano.' });
      if (!plano) return res.status(404).json({ mensagem: 'Plano não encontrado.' });
      res.json(plano);
    });
  },

  create(req, res) {
    const { nome, descricao, preco, duracao_meses, status } = req.body;

    if (!nome) {
      return res.status(400).json({ mensagem: 'Nome do plano é obrigatório.' });
    }

    Plano.create({ nome, descricao, preco, duracao_meses, status }, (err, result) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao criar plano.' });
      res.status(201).json({
        mensagem: 'Plano criado com sucesso.',
        plano: { id: result.lastID, nome, descricao, preco, duracao_meses, status },
      });
    });
  },

  atualizar(req, res) {
    const { nome, descricao, preco, duracao_meses, status } = req.body;
    Plano.atualizar(req.params.id, { nome, descricao, preco, duracao_meses, status }, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao atualizar plano.' });
      res.json({ mensagem: 'Plano atualizado com sucesso.' });
    });
  },

  excluir(req, res) {
    Plano.excluir(req.params.id, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao excluir plano.' });
      res.json({ mensagem: 'Plano excluído com sucesso.' });
    });
  },
};

module.exports = planoController;
