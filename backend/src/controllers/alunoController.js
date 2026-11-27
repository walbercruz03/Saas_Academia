const { promisify } = require('node:util');
const Aluno = require('../models/Aluno');
const AlunoModeloTreino = require('../models/AlunoModeloTreino');
const { normalizarDocumento, extrairCpfCompleto, mascararCpf } = require('../utils/documentosBrasileiros');
const logFalha = require('../utils/logFalha');

const validarModelos = promisify(AlunoModeloTreino.validarModelos);

const { acesso } = require('../services/permissoesProfessor');
function ocultarSaude(req, aluno) {
  if (req.usuario.cargo !== 'professor' || acesso(req.permissoesProfessor,'saude','visualizar')) return aluno;
  const { anamnese, contato_emergencia, ...dados } = aluno;
  return dados;
}

const cpfValido = (valor) => normalizarDocumento(valor, 'pessoa_fisica');
const erroCpf = (res) => res.status(400).json({ mensagem: 'Informe um CPF válido, com 11 dígitos e dígitos verificadores corretos.' });

function cpfDuplicado(erro) {
  return (erro.code === '23505' && ['alunos_academia_cpf_portal_idx','alunos_academia_id_cpf_key','alunos_cpf_key'].includes(erro.constraint)) ||
    (erro.code === 'SQLITE_CONSTRAINT' && /(?:UNIQUE constraint failed: alunos\.(?:academia_id, alunos\.)?cpf|CPF duplicado na academia)$/.test(erro.message));
}

function apresentarCpf({ cpf, ...aluno }) {
  return { ...aluno, cpf: mascararCpf(cpf), cpf_invalido: Boolean(cpf && !cpfValido(cpf.replace(/\D/g, ''))) };
}

const alunoController = {
  listar(req, res) {
    const { academia_id } = req.usuario;

    const incluirTelefone = req.query.resumo === 'checkin';
    Aluno.listar({ academia_id, resumo: req.query.resumo === '1' || incluirTelefone, incluirTelefone }, (err, alunos) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar alunos.' });
      res.set('Cache-Control', 'no-store').json(alunos.map((aluno) => apresentarCpf(ocultarSaude(req,aluno))));
    });
  },

  buscarCpf(req, res) {
    const cpf = extrairCpfCompleto(req.body?.cpf);
    if (!cpf) return res.status(400).json({ mensagem: 'Informe o CPF completo.' });
    Aluno.buscarPorCpf(cpf, req.usuario.academia_id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar aluno.' });
      return res.set('Cache-Control', 'no-store').json({ id: aluno?.id ?? null });
    });
  },

  findById(req, res) {
    res.set('Cache-Control', 'no-store');
    Aluno.findById(req.params.id, req.usuario.academia_id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });

      if (req.usuario.cargo === 'professor' && !acesso(req.permissoesProfessor,'modelos','visualizar')) {
        return res.json({ ...apresentarCpf(ocultarSaude(req,aluno)), modelos:[] });
      }
      AlunoModeloTreino.listarPorAluno(req.params.id, req.usuario.academia_id, (modErr, modelos) => {
        if (modErr) {
          logFalha('Erro ao buscar modelos do aluno', modErr);
          return res.json({ ...apresentarCpf(ocultarSaude(req,aluno)), modelos: [] });
        }
        res.json({ ...apresentarCpf(ocultarSaude(req,aluno)), modelos: modelos || [] });
      });
    });
  },

  async create(req, res) {
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

    const cpfNormalizado = cpfValido(cpf);
    if (cpf != null && cpf !== '' && !cpfNormalizado) return erroCpf(res);

    try {
      await validarModelos(modelos_ids ?? [], req.usuario.academia_id);
    } catch (erro) {
      return res.status(erro.status || 500).json({
        mensagem: erro.status ? erro.message : 'Erro ao validar modelos de treino.',
      });
    }

    Aluno.create(
      { nome, cpf: cpfNormalizado, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status, academia_id: req.usuario.academia_id },
      (err, result) => {
        if (err && cpfDuplicado(err)) return res.status(409).json({ mensagem: 'Este CPF já está cadastrado nesta academia.' });
        if (err) return res.status(500).json({ mensagem: 'Erro ao criar aluno.' });
        const novoAlunoId = result.lastID;

        // Se foram selecionados modelos de treinamento no cadastro, realiza a atribuição lógica
        const listaIds = Array.isArray(modelos_ids) ? modelos_ids : [];
        if (listaIds.length > 0) {
          AlunoModeloTreino.atribuirMultiplos(novoAlunoId, listaIds, null, req.usuario.academia_id, (attrErr, modelosAtribuidos) => {
            if (attrErr) {
              logFalha('Erro ao atribuir modelos ao aluno no cadastro', attrErr);
            }
            return res.status(201).json({
              mensagem: 'Aluno cadastrado com sucesso com modelos de treino atribuídos.',
              aluno: {
                id: novoAlunoId,
                nome,
                cpf: mascararCpf(cpfNormalizado),
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
            aluno: { id: novoAlunoId, nome, cpf: mascararCpf(cpfNormalizado), telefone, email, data_nascimento, status, modelos: [] },
          });
        }
      }
    );
  },

  async atualizar(req, res) {
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

    const cpfNormalizado = cpfValido(cpf);
    if (cpf != null && cpf !== '' && !cpfNormalizado) return erroCpf(res);

    try {
      await validarModelos(modelos_ids ?? [], req.usuario.academia_id);
    } catch (erro) {
      return res.status(erro.status || 500).json({
        mensagem: erro.status ? erro.message : 'Erro ao validar modelos de treino.',
      });
    }

    Aluno.atualizar(
      req.params.id,
      { nome, cpf: cpfNormalizado ?? undefined, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status },
      req.usuario.academia_id,
      function (err) {
        if (err && cpfDuplicado(err)) return res.status(409).json({ mensagem: 'Este CPF já está cadastrado nesta academia.' });
        if (err) return res.status(500).json({ mensagem: 'Erro ao atualizar aluno.' });

        if (!this.changes) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });

        // Se a lista de modelos_ids foi enviada na atualização, sincroniza
        if (Array.isArray(modelos_ids)) {
          AlunoModeloTreino.listarPorAluno(req.params.id, req.usuario.academia_id, (listErr, modelosAtuais) => {
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
              AlunoModeloTreino.desassociar(req.params.id, mId, req.usuario.academia_id, () => checkFim());
            });

            if (paraAdicionar.length > 0) {
              AlunoModeloTreino.atribuirMultiplos(req.params.id, paraAdicionar, null, req.usuario.academia_id, () => checkFim());
            }
          });
        } else {
          res.json({ mensagem: 'Aluno atualizado com sucesso.' });
        }
      }
    );
  },

  excluir(req, res) {
    Aluno.excluir(req.params.id, req.usuario.academia_id, function (err) {
      if (err) return res.status(500).json({ mensagem: 'Erro ao excluir aluno.' });
      if (!this.changes) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
      res.json({ mensagem: 'Aluno excluído com sucesso.' });
    });
  },

  // Endpoints dedicados de atribuição de modelos ao aluno
  listarModelos(req, res) {
    const { id } = req.params;
    Aluno.findById(id, req.usuario.academia_id, (erro, aluno) => {
      if (erro) return res.status(500).json({ erro: 'Erro ao verificar aluno.' });
      if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
      AlunoModeloTreino.listarPorAluno(id, req.usuario.academia_id, (err, modelos) => {
        if (err) {
          logFalha('Erro ao listar modelos do aluno', err);
          return res.status(500).json({ erro: 'Erro ao listar modelos de treino do aluno.' });
        }
        res.json(modelos || []);
      });
    });
  },

  atribuirModelo(req, res) {
    const { id } = req.params;
    const { modelo_id, modelos_ids, data_inicio, observacoes } = req.body || {};

    if (Array.isArray(modelos_ids) && modelos_ids.length > 0) {
      AlunoModeloTreino.atribuirMultiplos(id, modelos_ids, observacoes, req.usuario.academia_id, (err, lista) => {
        if (err) {
          if (err.status === 400 || err.status === 404) return res.status(err.status).json({ erro: err.message });
          logFalha('Erro ao atribuir múltiplos modelos', err);
          return res.status(500).json({ erro: 'Erro ao atribuir modelos de treino ao aluno.' });
        }
        return res.status(201).json(lista || []);
      });
    } else {
      if (!modelo_id) {
        return res.status(400).json({ erro: 'O campo modelo_id é obrigatório.' });
      }

      AlunoModeloTreino.atribuir(id, { modelo_id, data_inicio, observacoes }, req.usuario.academia_id, (err, lista) => {
        if (err) {
          if (err.status === 400 || err.status === 404) return res.status(err.status).json({ erro: err.message });
          logFalha('Erro ao atribuir modelo ao aluno', err);
          return res.status(500).json({ erro: 'Erro ao atribuir modelo de treino ao aluno.' });
        }
        return res.status(201).json(lista || []);
      });
    }
  },

  desassociarModelo(req, res) {
    const { id, modeloId } = req.params;
    AlunoModeloTreino.desassociar(id, modeloId, req.usuario.academia_id, (err, resultado) => {
      if (err) {
        logFalha('Erro ao remover modelo do aluno', err);
        return res.status(500).json({ erro: 'Erro ao remover modelo do aluno.' });
      }
      if (!resultado.changes) return res.status(404).json({ erro: 'Vínculo não encontrado.' });
      res.json({ mensagem: 'Modelo de treino desvinculado do aluno com sucesso.' });
    });
  },
};

module.exports = alunoController;

