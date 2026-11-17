const jwt = require('jsonwebtoken');

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
  const secret = process.env.JWT_SECRET || 'wcfit_secret_dev';

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ mensagem: 'Token inválido ou expirado.' });
    }

    req.usuario = {
      id: decoded.id,
      nome: decoded.nome,
      email_ou_matricula: decoded.email_ou_matricula,
      cargo: decoded.cargo,
    };

    next();
  });
};

module.exports = authMiddleware;
