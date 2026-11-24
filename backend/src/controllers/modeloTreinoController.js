
const ModeloTreino = require('../models/ModeloTreino');

const academiaUsuario = (req) => {
  const valor = req.usuario?.academia_id;
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// Deve ser definido por middleware seguro no backend.
// Não confiar em uma flag enviada pelo cliente.
const adminGlobal = (req) =>
  req.usuario?.admin_global_autorizado === true;

const global = (modelo) =>
  modelo.academia_id !== null &&
  modelo.academia_id !== undefined &&
  Number(modelo.academia_id) === 0;

const pertence = (modelo, academiaId) =>
  academiaId !== null &&
  Number(modelo.academia_id) === academiaId;

const responderErro = (res, err, mensagem) => {
  if ([400, 403, 404].includes(err?.status)) {
    return res.status(err.status).json({ erro: err.message });
  }
  console.error(mensagem, err);
  return res.status(500).json({ erro: mensagem });
};

const obterEscopo = (req, res) => {
  const academiaId = academiaUsuario(req);
  if (academiaId === null && !adminGlobal(req)) {
    res.status(403).json({
      erro: 'Usuário sem academia válida.'
    });
    return { permitido: false };
  }
  return { permitido: true, academiaId };
};

const idValido = (id) =>
  Number.isSafeInteger(Number(id)) && Number(id) > 0;

const modeloTreinoController = {
  listar(req, res) {
    const escopo = obterEscopo(req, res);
    if (!escopo.permitido) return;

    const {
      busca = '',
      modalidade_id = '',
      nivel_id = '',
      nivel = '',
      apenas_ativos = ''
    } = req.query;

    ModeloTreino.listar({
      busca,
      modalidadeId: modalidade_id,
      nivelId: nivel_id,
      nivel,
      apenasAtivos:
        apenas_ativos === '1' ||
        apenas_ativos === 'true',
      academia_id: escopo.academiaId ?? 0,
      incluirGlobais: true
    }, (err, modelos) => {
      if (err) {
        return responderErro(
          res, err, 'Erro ao listar modelos.'
        );
      }
      return res.json(modelos || []);
    });
  },

  buscarPorId(req, res) {
    const escopo = obterEscopo(req, res);
    if (!escopo.permitido) return;

    if (!idValido(req.params.id)) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }

    ModeloTreino.buscarPorId(req.params.id, (err, modelo) => {
      if (err) {
        return responderErro(
          res, err, 'Erro ao buscar modelo.'
        );
      }

      if (!modelo) {
        return res.status(404).json({
          erro: 'Modelo não encontrado.'
        });
      }

      const autorizado =
        global(modelo) ||
        pertence(modelo, escopo.academiaId) ||
        adminGlobal(req);

      if (!autorizado) {
        return res.status(404).json({
          erro: 'Modelo não encontrado.'
        });
      }

      return res.json(modelo);
    });
  },

  criar(req, res) {
    const escopo = obterEscopo(req, res);
    if (!escopo.permitido) return;

    const {
      nome, descricao,
      divisao = 'Treino A',
      modalidade_id, nivel_id,
      nivel = 'intermediario',
      objetivo, ativo = 1,
      divisoes = [], exercicios = []
    } = req.body || {};

    if (!String(nome || '').trim()) {
      return res.status(400).json({
        erro: 'O nome do modelo é obrigatório.'
      });
    }

    // Academia vem da autenticação, nunca do body.
    // Admin global sem academia cria registro global.
    const academiaId = escopo.academiaId ?? 0;

    ModeloTreino.criar({
      nome: String(nome).trim(),
      descricao,
      divisao,
      modalidade_id: modalidade_id || null,
      nivel_id: nivel_id || null,
      nivel,
      objetivo,
      professor_id: req.usuario.id,
      academia_id: academiaId,
      ativo,
      divisoes,
      exercicios
    }, (err, criado) => {
      if (err) {
        return responderErro(
          res, err, 'Erro ao criar modelo.'
        );
      }
      return res.status(201).json(criado);
    });
  },

  atualizar(req, res) {
    const escopo = obterEscopo(req, res);
    if (!escopo.permitido) return;

    if (!idValido(req.params.id)) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }

    const dados = req.body || {};

    if (!String(dados.nome || '').trim()) {
      return res.status(400).json({
        erro: 'O nome do modelo é obrigatório.'
      });
    }

    ModeloTreino.buscarPorId(req.params.id, (err, modelo) => {
      if (err) {
        return responderErro(
          res, err, 'Erro ao verificar modelo.'
        );
      }

      if (!modelo) {
        return res.status(404).json({
          erro: 'Modelo não encontrado.'
        });
      }

      const permitido = global(modelo)
        ? adminGlobal(req) && escopo.academiaId === null
        : pertence(modelo, escopo.academiaId);

      if (!permitido) {
        return res.status(403).json({
          erro: 'Sem permissão para alterar este modelo.'
        });
      }

      ModeloTreino.atualizar(req.params.id, {
        nome: String(dados.nome).trim(),
        descricao: dados.descricao,
        divisao: dados.divisao ?? 'Treino A',
        modalidade_id: dados.modalidade_id ?? null,
        nivel_id: dados.nivel_id ?? null,
        nivel: dados.nivel ?? 'intermediario',
        objetivo: dados.objetivo,
        professor_id: req.usuario.id,
        academia_id: global(modelo)
          ? 0 : escopo.academiaId,
        ativo: dados.ativo ?? 1,
        divisoes: dados.divisoes ?? [],
        exercicios: dados.exercicios ?? []
      }, (updateErr, atualizado) => {
        if (updateErr) {
          return responderErro(
            res, updateErr, 'Erro ao atualizar modelo.'
          );
        }
        return res.json(atualizado);
      });
    });
  },

  duplicar(req, res) {
    const academiaId = academiaUsuario(req);

    if (academiaId === null) {
      return res.status(403).json({
        erro: 'É necessária uma academia autenticada.'
      });
    }

    if (!idValido(req.params.id)) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }

    ModeloTreino.buscarPorId(req.params.id, (err, original) => {
      if (err) {
        return responderErro(
          res, err, 'Erro ao buscar modelo.'
        );
      }

      if (!original ||
          !(global(original) || pertence(original, academiaId))) {
        return res.status(404).json({
          erro: 'Modelo não encontrado.'
        });
      }

      const nome = String(
        req.body?.nome || `${original.nome} (Cópia)`
      ).trim();

      ModeloTreino.criar({
        nome,
        descricao: original.descricao,
        divisao: original.divisao,
        modalidade_id: original.modalidade_id,
        nivel_id: original.nivel_id,
        nivel: original.nivel,
        objetivo: original.objetivo,
        professor_id: req.usuario.id,
        academia_id: academiaId,
        ativo: original.ativo,
        divisoes: original.divisoes || []
      }, (createErr, duplicado) => {
        if (createErr) {
          return responderErro(
            res, createErr, 'Erro ao duplicar modelo.'
          );
        }
        return res.status(201).json(duplicado);
      });
    });
  },

  deletar(req, res) {
    const escopo = obterEscopo(req, res);
    if (!escopo.permitido) return;

    if (!idValido(req.params.id)) {
      return res.status(400).json({ erro: 'ID inválido.' });
    }

    ModeloTreino.buscarPorId(req.params.id, (err, modelo) => {
      if (err) {
        return responderErro(
          res, err, 'Erro ao verificar modelo.'
        );
      }

      if (!modelo) {
        return res.status(404).json({
          erro: 'Modelo não encontrado.'
        });
      }

      if (global(modelo)) {
        return res.status(403).json({
          erro: 'Modelos globais não podem ser excluídos.'
        });
      }

      if (!pertence(modelo, escopo.academiaId)) {
        return res.status(403).json({
          erro: 'Sem permissão para excluir este modelo.'
        });
      }

      ModeloTreino.deletar(
        req.params.id,
        escopo.academiaId,
        (deleteErr) => {
          if (deleteErr) {
            return responderErro(
              res, deleteErr, 'Erro ao excluir modelo.'
            );
          }
          return res.json({
            mensagem: 'Modelo removido com sucesso.'
          });
        }
      );
    });
  }
};

module.exports = modeloTreinoController;
