const Matricula = require('../models/Matricula');

const matriculaController = {
  listar(req, res) {
    Matricula.listar((err, matriculas) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar matrículas.' });
      res.json(matriculas);
    });
  },

  findById(req, res) {
    Matricula.findById(req.params.id, (err, matricula) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar matrícula.' });
      if (!matricula) return res.status(404).json({ mensagem: 'Matrícula não encontrada.' });
      res.json(matricula);
    });
  },

  create(req, res) {
    const { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago } = req.body;

    if (!aluno_id || !plano_id || !data_inicio || !data_vencimento) {
      return res.status(400).json({ mensagem: 'Aluno, plano, data de início e vencimento são obrigatórios.' });
    }

    Matricula.create({ aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago }, (err, result) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao criar matrícula.' });
      res.status(201).json({
        mensagem: 'Matrícula criada com sucesso.',
        matricula: { id: result.lastID, aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago },
      });
    });
  },

  atualizar(req, res) {
    const { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago } = req.body;
    Matricula.atualizar(req.params.id, { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago }, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao atualizar matrícula.' });
      res.json({ mensagem: 'Matrícula atualizada com sucesso.' });
    });
  },

  excluir(req, res) {
    Matricula.excluir(req.params.id, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao excluir matrícula.' });
      res.json({ mensagem: 'Matrícula excluída com sucesso.' });
    });
  },
};

module.exports = matriculaController;
