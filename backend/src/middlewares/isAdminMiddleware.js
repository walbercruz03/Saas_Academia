const isAdminMiddleware = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ mensagem: 'Usuário não autenticado.' });
  }

  if (req.usuario.cargo !== 'admin') {
    return res.status(403).json({ mensagem: 'Acesso restrito a administradores.' });
  }

  next();
};

module.exports = isAdminMiddleware;
