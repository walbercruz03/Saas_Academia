const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'wcfit_secret_dev';
const JWT_EXPIRES_IN = '12h';

const gerarToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      email_ou_matricula: usuario.email_ou_matricula,
      cargo: usuario.cargo,
      academia_id: usuario.academia_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const authController = {
  registerAdmin(req, res) {
    const { nome, idade, cpf, email_ou_matricula, telefone, senha, academia_id } = req.body;

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
        { nome, idade, cpf, email_ou_matricula, telefone, senha, cargo: 'admin', academia_id },
        (err, result) => {
          if (err) {
            return res.status(500).json({ mensagem: 'Erro ao criar administrador.' });
          }
          res.status(201).json({
            mensagem: 'Administrador criado com sucesso.',
            usuario: {
              id: result.lastID,
              nome,
              idade,
              cpf,
              email_ou_matricula,
              telefone,
              cargo: 'admin',
              academia_id,
            },
          });
        }
      );
    });
  },

  login(req, res) {
    const { email_ou_matricula, senha } = req.body;

    if (!email_ou_matricula || !senha) {
      return res.status(400).json({ mensagem: 'E-mail/matrícula e senha são obrigatórios.' });
    }

    Usuario.findByEmailOuMatricula(email_ou_matricula, (err, usuario) => {
      if (err) {
        return res.status(500).json({ mensagem: 'Erro ao buscar usuário.' });
      }
      if (!usuario) {
        return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
      }

      const senhaValida = Usuario.validarSenha(senha, usuario.senha_hash);
      if (!senhaValida) {
        return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
      }

      if (usuario.status !== 'ativo') {
        return res.status(403).json({ mensagem: 'Usuário inativo. Procure o administrador.' });
      }

      const token = gerarToken(usuario);

      res.json({
        mensagem: 'Login realizado com sucesso.',
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email_ou_matricula: usuario.email_ou_matricula,
          cargo: usuario.cargo,
          academia_id: usuario.academia_id,
        },
      });
    });
  },
};

module.exports = authController;
