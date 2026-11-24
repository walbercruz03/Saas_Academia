const Modalidade = require('../models/Modalidade');

const modalidadeController = {
  listar(req, res) {
    const { busca = '', apenas_ativos = '' } = req.query;
    const academia_id = req.usuario?.academia_id ?? null;

    Modalidade.listar(
      {
        busca,
        academia_id,
        apenasAtivos: apenas_ativos === '1' || apenas_ativos === 'true',
      },
      (err, rows) => {
        if (err) {
          console.error('Erro ao listar modalidades:', err.message);
          return res.status(500).json({ erro: 'Erro ao listar modalidades de treino.' });
        }
        res.json(rows || []);
      }
    );
  },

  buscarPorId(req, res) {
    const { id } = req.params;
    const academia_id = req.usuario?.academia_id ?? null;

    Modalidade.buscarPorId(id, academia_id, (err, modalidade) => {
      if (err) {
        console.error('Erro ao buscar modalidade:', err.message);
        return res.status(500).json({ erro: 'Erro ao buscar modalidade.' });
      }
      if (!modalidade) {
        return res.status(404).json({ erro: 'Modalidade não encontrada.' });
      }
      res.json(modalidade);
    });
  },

  criar(req, res) {
    const { nome, descricao, ativo = 1 } = req.body || {};
    const academia_id = req.usuario?.academia_id ?? null;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome da modalidade é obrigatório.' });
    }

    Modalidade.criar({ nome, descricao, ativo, academia_id }, (err, criado) => {
      if (err) {
        if (err.message && /unique/i.test(err.message)) {
          return res.status(400).json({ erro: 'Já existe uma modalidade com este nome.' });
        }
        console.error('Erro ao criar modalidade:', err.message);
        return res.status(500).json({ erro: 'Erro ao criar modalidade.' });
      }
      res.status(201).json(criado);
    });
  },

  atualizar(req, res) {
    const { id } = req.params;
    const { nome, descricao, ativo = 1 } = req.body || {};
    const academia_id = req.usuario?.academia_id ?? null;

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome da modalidade é obrigatório.' });
    }

    Modalidade.atualizar(id, { nome, descricao, ativo, academia_id }, (err, atualizado) => {
      if (err) {
        if (err.message && /unique/i.test(err.message)) {
          return res.status(400).json({ erro: 'Já existe uma modalidade com este nome.' });
        }
        console.error('Erro ao atualizar modalidade:', err.message);
        return res.status(500).json({ erro: 'Erro ao atualizar modalidade.' });
      }
      res.json(atualizado);
    });
  },

  deletar(req, res) {
    const { id } = req.params;
    const academia_id = req.usuario?.academia_id ?? null;

    Modalidade.deletar(id, academia_id, (err) => {
      if (err) {
        if (err.status === 400) {
          return res.status(400).json({ erro: err.message });
        }
        console.error('Erro ao excluir modalidade:', err.message);
        return res.status(500).json({ erro: 'Erro ao excluir modalidade.' });
      }
      res.json({ mensagem: 'Modalidade excluída com sucesso.' });
    });
  },
};

module.exports = modalidadeController;