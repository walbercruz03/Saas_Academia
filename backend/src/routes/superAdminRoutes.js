const router = require('express').Router();
const express = require('express');
const controller = require('../controllers/superAdminController');
const convite = require('../controllers/superAdminConviteController');
const operacional = require('../controllers/academiaOperacionalController');
const comercial = require('../controllers/comercialWcFitController');
const administradores = require('../controllers/gestaoAdministradoresController');

const executar = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const exigir = (...etapas) => executar((req, res, next) => controller.exigirEtapa(req, res, next, etapas));
const autenticada = exigir('autenticada');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (req.get('Sec-Fetch-Site') === 'cross-site' || req.get('Sec-Fetch-Site') === 'same-site') {
    return res.sendStatus(403);
  }
  if (req.method === 'POST' && !req.is('application/json')) return res.sendStatus(415);
  next();
});
router.use(express.json({ limit: '4kb' }));
router.post('/auth/login', executar(controller.login));
router.post('/auth/configurar', exigir('configurar'), executar(controller.configurar));
router.post('/auth/validar', exigir('configurar', 'validar'), executar(controller.validar));
router.post('/auth/recuperar', executar(controller.recuperar));
router.get('/auth/sessao', autenticada, executar(controller.sessao));
router.post('/auth/logout', exigir('configurar', 'validar', 'autenticada'),
  executar((req, res) => controller.encerrar(req, res)));
router.post('/auth/revogar', autenticada, executar((req, res) => controller.encerrar(req, res, true)));
router.get('/dashboard', autenticada, executar(controller.dashboard));
function mesmaOrigem(req, res, next) {
  try {
    const origem = new URL(req.get('Origin'));
    const protocolo = process.env.NODE_ENV === 'production' || req.secure ? 'https:' : 'http:';
    const local = process.env.SUPER_ADMIN_ORIGEM_LOCAL === 'http://localhost' && origem.origin === 'http://localhost';
    if (origem.origin === req.get('Origin') && origem.host === req.get('Host') && (origem.protocol === protocolo || local) &&
        ['same-origin', undefined].includes(req.get('Sec-Fetch-Site'))) return next();
  } catch {
    // Requisições sem origem válida são bloqueadas.
  }
  return res.status(403).json({ mensagem: 'Origem da operação não autorizada.' });
}

const gestaoAcademias = require('../controllers/gestaoAcademiasController');
router.post('/academias/novo-cadastro', autenticada, mesmaOrigem, gestaoAcademias.visualizar);
router.post('/academias/cadastro-completo', autenticada, mesmaOrigem, gestaoAcademias.cadastrar);
router.post('/academias/:id/dados', autenticada, mesmaOrigem, gestaoAcademias.visualizar);
router.post('/academias/:id/editar', autenticada, mesmaOrigem, gestaoAcademias.editar);
router.post('/academias/:id/excluir', autenticada, mesmaOrigem, gestaoAcademias.excluir(false));
router.post('/academias/:id/excluir-definitivamente', autenticada, mesmaOrigem, gestaoAcademias.excluir(true));
router.get('/academias', autenticada, executar(controller.academias));
router.post('/academias/filtrar', autenticada, executar(controller.academias));
router.get('/academias/:id/cadastro', autenticada, executar(controller.cadastroAcademia));
router.post('/academias', autenticada, mesmaOrigem, executar(controller.cadastrarAcademia));
router.get('/administradores', autenticada, executar(controller.administradores));
router.get('/administradores/:id/gestao', autenticada, administradores.detalhes);
for (const acao of ['editar','email','senha','desativar','reativar','excluir','excluir-definitivamente','revogar']) {
  router.post(`/administradores/:id/${acao}`, autenticada, mesmaOrigem, administradores.operar(acao));
}
router.get('/academias/:id/historico-operacional', autenticada, executar(operacional.historico));
for (const operacao of ['ativar', 'suspender', 'reativar', 'regularizar']) {
  router.post(`/academias/:id/${operacao}`, autenticada, mesmaOrigem, executar(operacional.alterar(operacao)));
}
router.get('/academias/:id/administradores', autenticada, executar(controller.administradores));
router.post('/auth/totp-recente', autenticada, mesmaOrigem, executar(controller.confirmarTotpRecente));
router.get('/convites', autenticada, executar(convite.listar));
router.post('/academias/:id/convites', autenticada, mesmaOrigem, executar(convite.emitir));
router.post('/convites/limpar', autenticada, mesmaOrigem, executar(convite.limpar));
router.post('/convites/:id/excluir', autenticada, mesmaOrigem, executar(convite.limpar));
router.post('/convites/:id/revogar', autenticada, mesmaOrigem, executar(convite.revogar));
router.get('/auditoria', autenticada, executar(controller.auditoria));
router.get('/assinaturas', autenticada, comercial.listar);
router.get('/assinaturas/:id', autenticada, comercial.detalhes);
router.get('/assinaturas/:id/asaas-sandbox', autenticada, comercial.cobrancasSandbox);
for (const acao of ['cliente','assinatura','cancelar','conciliar']) {
  router.post(`/assinaturas/:id/asaas-sandbox/${acao}`, autenticada, mesmaOrigem, comercial.operarSandbox(acao));
}
router.post('/assinaturas/precos', autenticada, mesmaOrigem, comercial.alterarPreco);
for (const acao of ['iniciar','conceder','revogar','receber']) {
  router.post(`/assinaturas/:id/${acao}`, autenticada, mesmaOrigem, comercial.operar(acao));
}
router.use((_err, _req, res, _next) => res.status(_err.status === 400 || _err.status === 413 ? _err.status : 503)
  .json({ mensagem: 'Não foi possível concluir a solicitação administrativa.' }));

module.exports = router;
