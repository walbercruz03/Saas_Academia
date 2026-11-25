const jwt = require('jsonwebtoken');

const segredoJwt = () => {
  const segredo = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' &&
      (!segredo || Buffer.byteLength(segredo) < 32 || new Set(segredo).size < 12 ||
       /^(?:wcfit|chave|secret|senha|password|changeme|default)/i.test(segredo))) {
    throw new Error('Configure JWT_SECRET de produção com um segredo aleatório de pelo menos 32 bytes.');
  }
  return segredo || 'wcfit_secret_dev';
};

const acessoAcademiaIndisponivel = (res) => res.status(403).json({
  codigo: 'ACADEMIA_INATIVA',
  mensagem: 'O acesso à sua academia está indisponível. Entre em contato com a administração.',
});

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ mensagem: 'Token não fornecido.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ mensagem: 'Formato de token inválido.' });
  }

  const token = parts[1];
  jwt.verify(token, segredoJwt(), { algorithms: ['HS256'], maxAge: '12h' }, (err, decoded) => {
    if (err || !Number.isSafeInteger(decoded?.id) || decoded.id <= 0 ||
        !Number.isSafeInteger(decoded?.exp)) {
      return res.status(401).json({ mensagem: 'Token inválido ou expirado.' });
    }

    const versao = decoded.versao_sessao === undefined ? '0' : decoded.versao_sessao;
    if (typeof versao !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(versao)) {
      return res.status(401).json({ mensagem: 'Token inválido ou expirado.' });
    }

    require('../models/Usuario').buscarSessao(decoded.id, async (erro, usuario) => {
      if (erro) return res.status(503).json({ mensagem: 'Não foi possível validar a sessão.' });
      if (!usuario || usuario.academia_id !== decoded.academia_id || usuario.cargo !== decoded.cargo) {
        return res.status(403).json({ mensagem: 'Sessão sem vínculo autorizado.' });
      }
      const { academia_ativa, versao_sessao, ...sessao } = usuario;
      if (academia_ativa !== 1) return acessoAcademiaIndisponivel(res);
      if (versao_sessao !== versao) return res.status(401).json({ mensagem: 'Sessão invalidada. Entre novamente.' });
      try {
        if (!require('../config/database').isSqlite &&
            await require('../services/autogestaoComercial').acessoExpirado(sessao.academia_id)) {
          return acessoAcademiaIndisponivel(res);
        }
        const sessoes = require('../models/SessaoUsuario');
        if (await sessoes.disponivel() && !await sessoes.valida(decoded.id,decoded.jti)) {
          return res.status(401).json({ mensagem: 'Sessão invalidada. Entre novamente.' });
        }
      } catch {
        return res.status(503).json({ mensagem: 'Não foi possível validar a sessão.' });
      }
      req.usuario = sessao;
      if (sessao.cargo === 'professor') {
        try {
          const permissoes = require('../services/permissoesProfessor');
          req.permissoesProfessor = await permissoes.obter(sessao);
          if (!permissoes.autorizar(req, req.permissoesProfessor)) {
            return res.status(403).json({ codigo: 'PERMISSAO_NEGADA', mensagem: 'Acesso não autorizado para este perfil.' });
          }
        } catch {
          return res.status(503).json({ mensagem: 'Não foi possível verificar as permissões.' });
        }
      }
      req.versaoSessaoValidada = versao;
      next();
    });
  });
};

module.exports = authMiddleware;
module.exports.segredoJwt = segredoJwt;
module.exports.acessoAcademiaIndisponivel = acessoAcademiaIndisponivel;
