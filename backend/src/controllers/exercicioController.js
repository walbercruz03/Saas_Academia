const Exercicio = require('../models/Exercicio');

const DIFICULDADES_VALIDAS = ['iniciante', 'intermediario', 'avancado'];

const exercicioController = {
  listar(req, res) {
    const { busca = '', equipamento = '', dificuldade = '', grupo_muscular_id = '', apenas_ativos = '' } = req.query;

    Exercicio.listar(
      {
        busca,
        equipamento,
        dificuldade,
        grupoMuscularId: grupo_muscular_id,
        apenasAtivos: apenas_ativos === '1' || apenas_ativos === 'true',
      },
      (err, rows) => {
        if (err) {
          console.error('Erro ao listar exercícios:', err.message);
          return res.status(500).json({ erro: 'Erro ao listar exercícios.' });
        }
        return res.json(rows || []);
      }
    );
  },

  buscarPorId(req, res) {
    const { id } = req.params;
    Exercicio.buscarPorId(id, (err, exercicio) => {
      if (err) {
        console.error('Erro ao buscar exercício:', err.message);
        return res.status(500).json({ erro: 'Erro ao buscar exercício.' });
      }
      if (!exercicio) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }
      return res.json(exercicio);
    });
  },

  criar(req, res) {
    const {
      nome,
      descricao,
      equipamento,
      dificuldade = 'intermediario',
      imagem_url,
      video_url,
      ativo,
      grupos_principais = [],
      grupos_secundarios = [],
    } = req.body || {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do exercício é obrigatório.' });
    }

    if (dificuldade && !DIFICULDADES_VALIDAS.includes(String(dificuldade).toLowerCase())) {
      return res.status(400).json({ erro: 'Dificuldade inválida. Use: iniciante, intermediario ou avancado.' });
    }

    Exercicio.criar(
      {
        nome,
        descricao,
        equipamento,
        dificuldade: String(dificuldade || 'intermediario').toLowerCase(),
        imagem_url,
        video_url,
        ativo,
        grupos_principais,
        grupos_secundarios,
      },
      (err, criado) => {
        if (err) {
          console.error('Erro ao criar exercício:', err.message);
          return res.status(500).json({ erro: 'Erro ao criar exercício.' });
        }
        return res.status(201).json(criado);
      }
    );
  },

  atualizar(req, res) {
    const { id } = req.params;
    const {
      nome,
      descricao,
      equipamento,
      dificuldade = 'intermediario',
      imagem_url,
      video_url,
      ativo,
      grupos_principais = [],
      grupos_secundarios = [],
    } = req.body || {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ erro: 'O nome do exercício é obrigatório.' });
    }

    if (dificuldade && !DIFICULDADES_VALIDAS.includes(String(dificuldade).toLowerCase())) {
      return res.status(400).json({ erro: 'Dificuldade inválida. Use: iniciante, intermediario ou avancado.' });
    }

    Exercicio.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar exercício:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao atualizar exercício.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }

      Exercicio.atualizar(
        id,
        {
          nome,
          descricao,
          equipamento,
          dificuldade: String(dificuldade || 'intermediario').toLowerCase(),
          imagem_url,
          video_url,
          ativo,
          grupos_principais,
          grupos_secundarios,
        },
        (err, atualizado) => {
          if (err) {
            console.error('Erro ao atualizar exercício:', err.message);
            return res.status(500).json({ erro: 'Erro ao atualizar exercício.' });
          }
          return res.json(atualizado);
        }
      );
    });
  },

  deletar(req, res) {
    const { id } = req.params;
    Exercicio.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar exercício:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao excluir exercício.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }

      Exercicio.deletar(id, (err) => {
        if (err) {
          console.error('Erro ao excluir exercício:', err.message);
          return res.status(500).json({ erro: 'Erro ao excluir exercício.' });
        }
        return res.json({ mensagem: 'Exercício removido com sucesso.' });
      });
    });
  },
};

module.exports = exercicioController;