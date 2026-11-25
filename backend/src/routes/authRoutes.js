const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { confirmar } = require('../controllers/gestaoAdministradoresController');

router.post('/register-admin', authController.registerAdmin);
router.post('/login', authController.login);
router.post('/confirmar-conta', (_req,res,next) => {
  res.set('Cache-Control','no-store');
  next();
}, confirmar);

router.get('/permissoes', require('../middlewares/authMiddleware'), (req, res) =>
  res.set('Cache-Control','no-store').json({ permissoes: req.permissoesProfessor ?? null }));

module.exports = router;
