const Matricula = require('../models/Matricula');

const matriculaController = {
  listar(req, res) {
    const { academia_id } = req.query;

    Matricula.listar({ academia_id }, (err, matriculas) => {
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

    // Verify academia ownership - aluno and plano must belong to same academia
    Matricula.findById(aluno_id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao verificar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });

      Matricula.findById(plano_id, (err, plano) => {
        if (err) return res.status(500).json({ mensagem: 'Erro ao verificar plano.' });
        if (!plano) return res.status(404).json({ mensagem: 'Plano não encontrado.' });

        if (aluno.academia_id !== plano.academia_id) {
          return res.status(403).json({ mensagem: 'O aluno e o plano devem pertencer à mesma academia.' });
        }

        Matricula.create({ aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, academia_id: aluno.academia_id }, (err, result) => {
          if (err) return res.status(500).json({ mensagem: 'Erro ao criar matrícula.' });
          res.status(201).json({
            mensagem: 'Matrícula criada com sucesso.',
            matricula: { id: result.lastID, aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago },
          });
        });
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
