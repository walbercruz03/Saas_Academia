const { promisify } = require('node:util');
const db = require('../config/database');
const buscarGrupos = promisify(db.all.bind(db));

async function validarGrupos(principais, secundarios, academiaId, res) {
  if (!Array.isArray(principais) || !Array.isArray(secundarios)) {
    res.status(400).json({ erro: 'Informe os grupos musculares como listas.' });
    return false;
  }
  const ids = [...new Set([...principais, ...secundarios].map(Number))];
  if (!ids.length) return true;
  if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    res.status(400).json({ erro: 'Grupo muscular inválido.' });
    return false;
  }
  try {
    const grupos = await buscarGrupos(
      `SELECT id FROM grupos_musculares WHERE academia_id IN (0, ?)
       AND id IN (${ids.map(() => '?').join(',')})`, [academiaId, ...ids]
    );
    if (grupos.length === ids.length) return true;
    res.status(404).json({ erro: 'Grupo muscular não encontrado.' });
  } catch {
    res.status(500).json({ erro: 'Erro ao validar grupos musculares.' });
  }
  return false;
}
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
        academia_id: req.usuario.academia_id,
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
    Exercicio.buscarPorId(id, req.usuario.academia_id, (err, exercicio) => {
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

  async criar(req, res) {
    const {
      nome,
      descricao,
      instrucoes,
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

    if (!await validarGrupos(grupos_principais, grupos_secundarios, req.usuario.academia_id, res)) return;

    Exercicio.criar(
      {
        nome,
        descricao,
        instrucoes,
        equipamento,
        dificuldade: String(dificuldade || 'intermediario').toLowerCase().trim(),
        imagem_url,
        video_url,
        ativo,
        grupos_principais,
        grupos_secundarios,
        academia_id: req.usuario.academia_id,
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

  async atualizar(req, res) {
    const { id } = req.params;
    const {
      nome,
      descricao,
      instrucoes,
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

    if (!await validarGrupos(grupos_principais, grupos_secundarios, req.usuario.academia_id, res)) return;

    Exercicio.buscarPorId(id, req.usuario.academia_id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar exercício:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao atualizar exercício.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }

      // Verify academia ownership
      if (existente.academia_id !== req.usuario.academia_id) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }

      Exercicio.atualizar(
        id,
        {
          nome,
          descricao,
          instrucoes,
          equipamento,
          dificuldade: String(dificuldade || 'intermediario').toLowerCase().trim(),
          imagem_url,
          video_url,
          ativo,
          grupos_principais,
          grupos_secundarios,
          academia_id: req.usuario.academia_id,
        },
        (err, atualizado) => {
          if (err) {
            console.error('Erro ao atualizar exercício:', err.message);
            return res.status(500).json({ erro: 'Erro ao atualizar exercício.' });
          }
          if (!atualizado) return res.status(404).json({ erro: 'Exercício não encontrado.' });
          return res.json(atualizado);
        }
      );
    });
  },

  deletar(req, res) {
    const { id } = req.params;
    Exercicio.buscarPorId(id, req.usuario.academia_id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar exercício:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao excluir exercício.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }

      // Verify academia ownership
      if (existente.academia_id !== req.usuario.academia_id) {
        return res.status(404).json({ erro: 'Exercício não encontrado.' });
      }

      Exercicio.deletar(id, req.usuario.academia_id, (err) => {
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