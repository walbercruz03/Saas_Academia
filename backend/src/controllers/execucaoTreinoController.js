const ExecucaoTreino = require('../models/ExecucaoTreino');

const execucaoTreinoController = {
  listar(req, res) {
    const {
      aluno_id = '',
      treino_id = '',
      modelo_id = '',
      data_inicio = '',
      data_fim = '',
    } = req.query;

    ExecucaoTreino.listar(
      {
        alunoId: aluno_id,
        treinoId: treino_id,
        modeloId: modelo_id,
        dataInicio: data_inicio,
        dataFim: data_fim,
      },
      (err, rows) => {
        if (err) {
          console.error('Erro ao listar execuções de treino:', err.message);
          return res.status(500).json({ erro: 'Erro ao listar histórico de execuções.' });
        }
        return res.json(rows || []);
      }
    );
  },

  criar(req, res) {
    const {
      treino_id,
      aluno_id,
      modelo_id,
      divisao_id,
      modelo_nome,
      divisao_nome,
      snapshot_treino,
      data_execucao,
      duracao_minutos,
      percepcao_esforco,
      observacao,
      cargas = [],
    } = req.body || {};

    if (!aluno_id) {
      return res.status(400).json({ erro: 'O aluno é obrigatório.' });
    }

    if (!treino_id && !modelo_id && !divisao_id && !modelo_nome) {
      return res.status(400).json({ erro: 'A ficha ou modelo de treino executado é obrigatório.' });
    }

    ExecucaoTreino.criar(
      {
        treino_id,
        aluno_id,
        modelo_id,
        divisao_id,
        modelo_nome,
        divisao_nome,
        snapshot_treino,
        data_execucao,
        duracao_minutos,
        percepcao_esforco,
        observacao,
        cargas,
      },
      (err, criada) => {
        if (err) {
          console.error('Erro ao registrar execução de treino:', err.message);
          return res.status(500).json({ erro: 'Erro ao registrar execução de treino.' });
        }
        return res.status(201).json(criada);
      }
    );
  },

  deletar(req, res) {
    const { id } = req.params;
    ExecucaoTreino.buscarPorId(id, (buscaErr, existente) => {
      if (buscaErr) {
        console.error('Erro ao verificar execução de treino:', buscaErr.message);
        return res.status(500).json({ erro: 'Erro ao excluir registro de execução.' });
      }
      if (!existente) {
        return res.status(404).json({ erro: 'Registro de execução não encontrado.' });
      }

      ExecucaoTreino.deletar(id, (err) => {
        if (err) {
          console.error('Erro ao excluir execução de treino:', err.message);
          return res.status(500).json({ erro: 'Erro ao excluir registro de execução.' });
        }
        return res.json({ mensagem: 'Execução removida com sucesso.' });
      });
    });
  },
};

module.exports = execucaoTreinoController;
