const GrupoMuscular = require('../models/GrupoMuscular');

const grupoMuscularController = {
  listar(req, res) {
    const { busca = '' } = req.query;
    GrupoMuscular.listar({ busca }, (err, rows) => {
      if (err) {
        console.error('Erro ao listar grupos musculares:', err.message);
        return res.status(500).json({ erro: 'Erro ao listar grupos musculares.' });
      }
      return res.json(rows || []);
    });
  },

  buscarPorId(req, res) {
    const { id } = req.params;
    GrupoMuscular.buscarPorId(id, (err, grupo) => {
      if (err) {
        console.error('Erro ao buscar grupo muscular:', err.message);
        return res.status(500).json({ erro: 'Erro ao buscar grupo muscular.' });
      }
      if (!grupo) {
        return res.status(404).json({ erro: 'Grupo muscular não encontrado.' });
      }
      return res.json(grupo);
    });
  },

  criar(req, res) {
    const { nome, descricao } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do grupo muscular é obrigatório.' });
    }

    GrupoMuscular.criar({ nome, descricao }, (err, criado) => {
      if (err) {
        if (/unique|duplicate/i.test(err.message)) {
          return res.status(409).json({ erro: 'Já existe um grupo muscular com esse nome.' });
        }
        console.error('Erro ao criar grupo muscular:', err.message);
        return res.status(500).json({ erro: 'Erro ao criar grupo muscular.' });
      }
      return res.status(201).json(criado);
    });
  },

  atualizar(req, res) {
    const { id } = req.params;
    const { nome, descricao } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do grupo muscular é obrigatório.' });
    }

    GrupoMuscular.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar grupo muscular:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao atualizar grupo muscular.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Grupo muscular não encontrado.' });
      }

      GrupoMuscular.atualizar(id, { nome, descricao }, (err, atualizado) => {
        if (err) {
          if (/unique|duplicate/i.test(err.message)) {
            return res.status(409).json({ erro: 'Já existe um grupo muscular com esse nome.' });
          }
          console.error('Erro ao atualizar grupo muscular:', err.message);
          return res.status(500).json({ erro: 'Erro ao atualizar grupo muscular.' });
        }
        return res.json(atualizado);
      });
    });
  },

  deletar(req, res) {
    const { id } = req.params;
    GrupoMuscular.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar grupo muscular:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao excluir grupo muscular.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Grupo muscular não encontrado.' });
      }

      GrupoMuscular.deletar(id, (err) => {
        if (err) {
          console.error('Erro ao excluir grupo muscular:', err.message);
          return res.status(500).json({ erro: 'Erro ao excluir grupo muscular.' });
        }
        return res.json({ mensagem: 'Grupo muscular removido com sucesso.' });
      });
    });
  },
};

module.exports = grupoMuscularController;