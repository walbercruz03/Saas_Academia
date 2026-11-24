const Checkin = require('../models/Checkin');
const Aluno = require('../models/Aluno');
const db = require('../config/database');

const checkinController = {
  listar(req, res) {
    const { academia_id } = req.query;

    Checkin.listar({ academia_id }, (err, checkins) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar check-ins.' });
      res.json(checkins);
    });
  },

  buscarAluno(req, res) {
    const { cpf } = req.query;
    if (!cpf) {
      return res.status(400).json({ mensagem: 'CPF é obrigatório.' });
    }
    const cpfLimpo = cpf.replace(/\D/g, '');
    const sql = `SELECT * FROM alunos WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?`;
    db.get(sql, [cpfLimpo], (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
      res.json(aluno);
    });
  },

  realizarCheckin(req, res) {
    const { aluno_id, status = 'presente', observacoes } = req.body;

    if (!aluno_id) {
      return res.status(400).json({ mensagem: 'Aluno é obrigatório.' });
    }

    Checkin.buscarAlunoPorId(aluno_id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao verificar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });

      // Verify academia ownership
      if (aluno.academia_id !== req.usuario.academia_id) {
        return res.status(403).json({ mensagem: 'Não é permitido registrar check-in para aluno de outra academia.' });
      }

      Checkin.create({ aluno_id, status, observacoes, academia_id: aluno.academia_id }, (err, result) => {
        if (err) return res.status(500).json({ mensagem: 'Erro ao registrar check-in.' });
        res.status(201).json({
          mensagem: 'Check-in realizado com sucesso.',
          checkin: { id: result.lastID, aluno_id, aluno_nome: aluno.nome, status, data_checkin: new Date().toISOString() },
        });
      });
    });
  },
};

module.exports = checkinController;
