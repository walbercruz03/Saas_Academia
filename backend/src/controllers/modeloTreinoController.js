const ModeloTreino = require('../models/ModeloTreino');

const NIVEIS_VALIDOS = ['iniciante', 'intermediario', 'avancado'];

const modeloTreinoController = {
  listar(req, res) {
    const { busca = '', nivel = '', apenas_ativos = '' } = req.query;

    ModeloTreino.listar(
      {
        busca,
        nivel,
        apenasAtivos: apenas_ativos === '1' || apenas_ativos === 'true',
      },
      (err, rows) => {
        if (err) {
          console.error('Erro ao listar modelos de treino:', err.message);
          return res.status(500).json({ erro: 'Erro ao listar modelos de treino.' });
        }
        return res.json(rows || []);
      }
    );
  },

  buscarPorId(req, res) {
    const { id } = req.params;
    ModeloTreino.buscarPorId(id, (err, modelo) => {
      if (err) {
        console.error('Erro ao buscar modelo de treino:', err.message);
        return res.status(500).json({ erro: 'Erro ao buscar modelo de treino.' });
      }
      if (!modelo) {
        return res.status(404).json({ erro: 'Modelo de treino não encontrado.' });
      }
      return res.json(modelo);
    });
  },

  criar(req, res) {
    const { nome, descricao, divisao, nivel = 'intermediario', ativo, exercicios = [] } = req.body || {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do modelo de treino é obrigatório.' });
    }

    if (nivel && !NIVEIS_VALIDOS.includes(String(nivel).toLowerCase())) {
      return res.status(400).json({ erro: 'Nível inválido. Use: iniciante, intermediario ou avancado.' });
    }

    ModeloTreino.criar(
      {
        nome,
        descricao,
        divisao,
        nivel: String(nivel || 'intermediario').toLowerCase(),
        ativo,
        exercicios,
      },
      (err, criado) => {
        if (err) {
          console.error('Erro ao criar modelo de treino:', err.message);
          return res.status(500).json({ erro: 'Erro ao criar modelo de treino.' });
        }
        return res.status(201).json(criado);
      }
    );
  },

  atualizar(req, res) {
    const { id } = req.params;
    const { nome, descricao, divisao, nivel = 'intermediario', ativo, exercicios = [] } = req.body || {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do modelo de treino é obrigatório.' });
    }

    if (nivel && !NIVEIS_VALIDOS.includes(String(nivel).toLowerCase())) {
      return res.status(400).json({ erro: 'Nível inválido. Use: iniciante, intermediario ou avancado.' });
    }

    ModeloTreino.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar modelo de treino:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao atualizar modelo de treino.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Modelo de treino não encontrado.' });
      }

      ModeloTreino.atualizar(
        id,
        {
          nome,
          descricao,
          divisao,
          nivel: String(nivel || 'intermediario').toLowerCase(),
          ativo,
          exercicios,
        },
        (err, atualizado) => {
          if (err) {
            console.error('Erro ao atualizar modelo de treino:', err.message);
            return res.status(500).json({ erro: 'Erro ao atualizar modelo de treino.' });
          }
          return res.json(atualizado);
        }
      );
    });
  },

  duplicar(req, res) {
    const { id } = req.params;
    const { nome } = req.body || {};

    ModeloTreino.duplicar(id, nome, (err, duplicado) => {
      if (err) {
        console.error('Erro ao duplicar modelo de treino:', err.message);
        return res.status(500).json({ erro: 'Erro ao duplicar modelo de treino.' });
      }
      if (!duplicado) {
        return res.status(404).json({ erro: 'Modelo de treino não encontrado.' });
      }
      return res.status(201).json(duplicado);
    });
  },

  deletar(req, res) {
    const { id } = req.params;
    ModeloTreino.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar modelo de treino:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao excluir modelo de treino.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Modelo de treino não encontrado.' });
      }

      ModeloTreino.deletar(id, (err) => {
        if (err) {
          console.error('Erro ao excluir modelo de treino:', err.message);
          return res.status(500).json({ erro: 'Erro ao excluir modelo de treino.' });
        }
        return res.json({ mensagem: 'Modelo de treino removido com sucesso.' });
      });
    });
  },
};

module.exports = modeloTreinoController;