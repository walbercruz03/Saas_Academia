const Aluno = require('../models/Aluno');
const AlunoModeloTreino = require('../models/AlunoModeloTreino');

const alunoController = {
  listar(req, res) {
    const { academia_id } = req.query;

    Aluno.listar({ academia_id }, (err, alunos) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar alunos.' });
      res.json(alunos);
    });
  },

  findById(req, res) {
    Aluno.findById(req.params.id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });

      AlunoModeloTreino.listarPorAluno(req.params.id, (modErr, modelos) => {
        if (modErr) {
          console.error('Erro ao buscar modelos do aluno:', modErr.message);
          return res.json({ ...aluno, modelos: [] });
        }
        res.json({ ...aluno, modelos: modelos || [] });
      });
    });
  },

  create(req, res) {
    const {
      nome,
      cpf,
      telefone,
      email,
      data_nascimento,
      foto,
      contato_emergencia,
      anamnese,
      status = 'ativo',
      modelos_ids = [],
    } = req.body;

    if (!nome) {
      return res.status(400).json({ mensagem: 'Nome do aluno é obrigatório.' });
    }

    Aluno.create(
      { nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status, academia_id: req.usuario.academia_id },
      (err, result) => {
        if (err) return res.status(500).json({ mensagem: 'Erro ao criar aluno.' });
        const novoAlunoId = result.lastID;

        // Se foram selecionados modelos de treinamento no cadastro, realiza a atribuição lógica
        const listaIds = Array.isArray(modelos_ids) ? modelos_ids : [];
        if (listaIds.length > 0) {
          AlunoModeloTreino.atribuirMultiplos(novoAlunoId, listaIds, null, (attrErr, modelosAtribuidos) => {
            if (attrErr) {
              console.error('Erro ao atribuir modelos ao aluno no cadastro:', attrErr.message);
            }
            return res.status(201).json({
              mensagem: 'Aluno cadastrado com sucesso com modelos de treino atribuídos.',
              aluno: {
                id: novoAlunoId,
                nome,
                cpf,
                telefone,
                email,
                data_nascimento,
                status,
                modelos: modelosAtribuidos || [],
              },
            });
          });
        } else {
          return res.status(201).json({
            mensagem: 'Aluno cadastrado com sucesso.',
            aluno: { id: novoAlunoId, nome, cpf, telefone, email, data_nascimento, status, modelos: [] },
          });
        }
      }
    );
  },

  atualizar(req, res) {
    const {
      nome,
      cpf,
      telefone,
      email,
      data_nascimento,
      foto,
      contato_emergencia,
      anamnese,
      status,
      modelos_ids,
    } = req.body;

    Aluno.atualizar(
      req.params.id,
      { nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status },
      (err) => {
        if (err) return res.status(500).json({ mensagem: 'Erro ao atualizar aluno.' });

        // Se a lista de modelos_ids foi enviada na atualização, sincroniza
        if (Array.isArray(modelos_ids)) {
          AlunoModeloTreino.listarPorAluno(req.params.id, (listErr, modelosAtuais) => {
            if (listErr) {
              return res.json({ mensagem: 'Aluno atualizado com sucesso.' });
            }

            const atuaisIds = new Set((modelosAtuais || []).map((m) => Number(m.id || m.modelo_id)));
            const novosIds = new Set(modelos_ids.map(Number));

            // Remove modelos desmarcados
            const paraRemover = [...atuaisIds].filter((id) => !novosIds.has(id));
            // Adiciona novos modelos
            const paraAdicionar = [...novosIds].filter((id) => !atuaisIds.has(id));

            let restantes = paraRemover.length + (paraAdicionar.length > 0 ? 1 : 0);
            if (restantes === 0) {
              return res.json({ mensagem: 'Aluno atualizado com sucesso.' });
            }

            const checkFim = () => {
              restantes -= 1;
              if (restantes <= 0) {
                res.json({ mensagem: 'Aluno e atribuições de treinamento atualizados com sucesso.' });
              }
            };

            paraRemover.forEach((mId) => {
              AlunoModeloTreino.desassociar(req.params.id, mId, () => checkFim());
            });

            if (paraAdicionar.length > 0) {
              AlunoModeloTreino.atribuirMultiplos(req.params.id, paraAdicionar, null, () => checkFim());
            }
          });
        } else {
          res.json({ mensagem: 'Aluno atualizado com sucesso.' });
        }
      }
    );
  },

  excluir(req, res) {
    Aluno.excluir(req.params.id, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao excluir aluno.' });
      res.json({ mensagem: 'Aluno excluído com sucesso.' });
    });
  },

  // Endpoints dedicados de atribuição de modelos ao aluno
  listarModelos(req, res) {
    const { id } = req.params;
    AlunoModeloTreino.listarPorAluno(id, (err, modelos) => {
      if (err) {
        console.error('Erro ao listar modelos do aluno:', err.message);
        return res.status(500).json({ erro: 'Erro ao listar modelos de treino do aluno.' });
      }
      res.json(modelos || []);
    });
  },

  atribuirModelo(req, res) {
    const { id } = req.params;
    const { modelo_id, modelos_ids, data_inicio, observacoes } = req.body || {};

    if (Array.isArray(modelos_ids) && modelos_ids.length > 0) {
      AlunoModeloTreino.atribuirMultiplos(id, modelos_ids, observacoes, (err, lista) => {
        if (err) {
          if (err.status === 400) return res.status(400).json({ erro: err.message });
          console.error('Erro ao atribuir múltiplos modelos:', err.message);
          return res.status(500).json({ erro: 'Erro ao atribuir modelos de treino ao aluno.' });
        }
        return res.status(201).json(lista || []);
      });
    } else {
      if (!modelo_id) {
        return res.status(400).json({ erro: 'O campo modelo_id é obrigatório.' });
      }

      AlunoModeloTreino.atribuir(id, { modelo_id, data_inicio, observacoes }, (err, lista) => {
        if (err) {
          if (err.status === 400) return res.status(400).json({ erro: err.message });
          console.error('Erro ao atribuir modelo ao aluno:', err.message);
          return res.status(500).json({ erro: 'Erro ao atribuir modelo de treino ao aluno.' });
        }
        return res.status(201).json(lista || []);
      });
    }
  },

  desassociarModelo(req, res) {
    const { id, modeloId } = req.params;
    AlunoModeloTreino.desassociar(id, modeloId, (err) => {
      if (err) {
        console.error('Erro ao remover modelo do aluno:', err.message);
        return res.status(500).json({ erro: 'Erro ao remover modelo do aluno.' });
      }
      res.json({ mensagem: 'Modelo de treino desvinculado do aluno com sucesso.' });
    });
  },
};

module.exports = alunoController;

