const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');
const sessoes = require('../models/SessaoUsuario');

const { segredoJwt, acessoAcademiaIndisponivel } = require('../middlewares/authMiddleware');
const JWT_EXPIRES_IN = '12h';

const gerarToken = (usuario, jti) => {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      email_ou_matricula: usuario.email_ou_matricula,
      cargo: usuario.cargo,
      academia_id: usuario.academia_id,
      versao_sessao: usuario.versao_sessao,
    },
    segredoJwt(),
    { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN, ...(jti && { jwtid: jti }) }
  );
};

const authController = {
  registerAdmin(req, res) {
    return res.status(403).json({ mensagem: 'Cadastro público de administradores indisponível.' });
  },

  login(req, res) {
    const { email_ou_matricula, senha } = req.body || {};

    if (typeof email_ou_matricula !== 'string' || !email_ou_matricula || typeof senha !== 'string' || !senha) {
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

      Usuario.buscarSessao(usuario.id, async (erro, sessao) => {
        if (erro) return res.status(503).json({ mensagem: 'Não foi possível validar a sessão.' });
        if (!sessao) return res.status(403).json({ mensagem: 'Usuário sem vínculo autorizado.' });

        if (usuario.academia_ativa !== 1 || sessao.academia_ativa !== 1) return acessoAcademiaIndisponivel(res);

        if (usuario.academia_id !== sessao.academia_id || usuario.cargo !== sessao.cargo ||
            usuario.versao_sessao !== sessao.versao_sessao) {
          return res.status(401).json({ mensagem: 'A sessão mudou durante o login. Tente novamente.' });
        }

        let jti;
        try {
          if (!require('../config/database').isSqlite &&
              await require('../services/autogestaoComercial').acessoExpirado(sessao.academia_id)) {
            return acessoAcademiaIndisponivel(res);
          }
          if (await sessoes.disponivel()) {
            jti = await sessoes.emitir(sessao, usuario.senha_hash);
            if (!jti) return res.status(401).json({ mensagem: 'A sessão mudou durante o login. Tente novamente.' });
          }
        } catch {
          return res.status(503).json({ mensagem: 'Não foi possível iniciar a sessão.' });
        }
        const token = gerarToken(sessao, jti);

        res.json({
          mensagem: 'Login realizado com sucesso.',
          token,
          usuario: {
            id: sessao.id,
            nome: sessao.nome,
            email_ou_matricula: sessao.email_ou_matricula,
            cargo: sessao.cargo,
            academia_id: sessao.academia_id,
          },
        });
      });
    });
  },
};

module.exports = authController;
