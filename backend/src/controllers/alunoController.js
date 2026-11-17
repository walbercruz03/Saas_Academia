const Aluno = require('../models/Aluno');

const alunoController = {
  listar(req, res) {
    Aluno.listar((err, alunos) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao listar alunos.' });
      res.json(alunos);
    });
  },

  findById(req, res) {
    Aluno.findById(req.params.id, (err, aluno) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao buscar aluno.' });
      if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
      res.json(aluno);
    });
  },

  create(req, res) {
    const { nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status } = req.body;

    if (!nome) {
      return res.status(400).json({ mensagem: 'Nome do aluno é obrigatório.' });
    }

    Aluno.create({ nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status }, (err, result) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao criar aluno.' });
      res.status(201).json({
        mensagem: 'Aluno cadastrado com sucesso.',
        aluno: { id: result.lastID, nome, cpf, telefone, email, data_nascimento, status },
      });
    });
  },

  atualizar(req, res) {
    const { nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status } = req.body;
    Aluno.atualizar(req.params.id, { nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status }, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao atualizar aluno.' });
      res.json({ mensagem: 'Aluno atualizado com sucesso.' });
    });
  },

  excluir(req, res) {
    Aluno.excluir(req.params.id, (err) => {
      if (err) return res.status(500).json({ mensagem: 'Erro ao excluir aluno.' });
      res.json({ mensagem: 'Aluno excluído com sucesso.' });
    });
  },
};

module.exports = alunoController;
