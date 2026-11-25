const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const isAdminMiddleware = require('../middlewares/isAdminMiddleware');
const Usuario = require('../models/Usuario');

// Listar professores/usuários (apenas admin)
router.get('/', authMiddleware, isAdminMiddleware, (req, res) => {
  Usuario.listar(req.usuario.academia_id, (err, usuarios) => {
    if (err) {
      return res.status(500).json({ mensagem: 'Erro ao listar usuários.' });
    }
    res.json(usuarios);
  });
});

// Cadastrar professor (apenas admin)
router.post('/', authMiddleware, isAdminMiddleware, (req, res) => {
  const { nome, email_ou_matricula, senha } = req.body;

  if (!nome || !email_ou_matricula || !senha) {
    return res.status(400).json({ mensagem: 'Nome, e-mail/matrícula e senha são obrigatórios.' });
  }

  Usuario.findByEmailOuMatricula(email_ou_matricula, (err, usuario) => {
    if (err) {
      return res.status(500).json({ mensagem: 'Erro ao verificar usuário.' });
    }
    if (usuario) {
      return res.status(409).json({ mensagem: 'E-mail/matrícula já cadastrado.' });
    }

    Usuario.create(
      { nome, email_ou_matricula, senha, cargo: 'professor', academia_id: req.usuario.academia_id },
      (err, result) => {
        if (err) {
          return res.status(500).json({ mensagem: 'Erro ao cadastrar professor.' });
        }
        res.status(201).json({
          mensagem: 'Professor cadastrado com sucesso.',
          usuario: {
            id: result.lastID,
            nome,
            email_ou_matricula,
            cargo: 'professor',
          },
        });
      }
    );
  });
});

// Atualizar status do usuário (apenas admin)
router.patch('/:id/status', authMiddleware, isAdminMiddleware, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['ativo', 'inativo'].includes(status)) {
    return res.status(400).json({ mensagem: 'Status inválido. Use "ativo" ou "inativo".' });
  }

  Usuario.atualizarStatus(id, status, req.usuario.academia_id, (err, alterados) => {
    if (err) {
      return res.status(500).json({ mensagem: 'Erro ao atualizar status.' });
    }
    if (!alterados) return res.status(404).json({ mensagem: 'Professor não encontrado.' });
    res.json({ mensagem: 'Status atualizado com sucesso.' });
  });
});

module.exports = router;
