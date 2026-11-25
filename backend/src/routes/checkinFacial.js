const facial = require('../services/checkinFacial');
const logFalha = require('../utils/logFalha');

const valido = (id) => /^[1-9][0-9]{0,9}$/.test(id) && Number(id) <= 2147483647;
const responder = (handler) => async (req,res) => {
  res.set('Cache-Control','no-store');
  try {
    return await handler(req,res,facial.contexto(req));
  } catch (falha) {
    if ([400,403,404,409,422,429,503].includes(falha.status)) {
      return res.status(falha.status).json({ mensagem:falha.message });
    }
    logFalha('Falha no check-in facial',falha);
    return res.status(503).json({ mensagem:'Check-in facial indisponível. Use o check-in manual.' });
  }
};

function registrar(rotas,autenticado,administrador,checkin) {
  rotas.get('/facial',autenticado,responder(async (_req,res,ctx) =>
    res.json(await facial.situacao(ctx.academia))));

  rotas.put('/facial',autenticado,administrador,responder(async (req,res,ctx) => {
    if (typeof req.body?.ativo !== 'boolean' || (req.body.ativo && req.body.politica_confirmada !== true)) {
      return res.status(400).json({ mensagem:'Confirme o estado e a política de privacidade antes de habilitar.' });
    }
    return res.json(await facial.configurar(ctx.academia,req.body.ativo));
  }));

  rotas.get('/facial/alunos/:id',autenticado,administrador,responder(async (req,res,ctx) => {
    if (!valido(req.params.id)) return res.status(400).json({ mensagem:'Aluno inválido.' });
    return res.json(await facial.cadastro(ctx.academia,Number(req.params.id)));
  }));

  rotas.delete('/facial/alunos/:id',autenticado,administrador,responder(async (req,res,ctx) => {
    if (!valido(req.params.id)) return res.status(400).json({ mensagem:'Aluno inválido.' });
    await facial.excluir(ctx.academia,Number(req.params.id));
    return res.status(204).end();
  }));

  rotas.post('/facial/desafio',autenticado,responder(async (req,res,ctx) => {
    const dados = req.body || {};
    if (dados.aluno_id !== undefined && req.usuario.cargo !== 'admin') {
      return res.status(403).json({ mensagem:'Somente administradores podem cadastrar biometria.' });
    }
    return res.json(await facial.iniciar(ctx,dados));
  }));

  rotas.post('/facial/verificar',autenticado,responder(async (req,res,ctx) =>
    res.json(await facial.verificar(ctx,req.body || {}))));

  rotas.post('/facial/confirmar',autenticado,responder(async (req,res,ctx) => {
    const aluno = await facial.confirmar(ctx,req.body || {});
    req.headers['idempotency-key'] = req.body.token;
    req.body = { aluno_id:aluno,status:'presente' };
    req[facial.confirmacaoFacial] = true;
    const enviar = res.json.bind(res);
    res.json = () => {
      if (res.statusCode >= 500) return enviar({ resultado:'indisponivel',mensagem:'Check-in indisponível. Consulte a recepção.' });
      if (res.statusCode >= 400) return enviar({ resultado:'negado',mensagem:'Acesso não liberado. Consulte a recepção.' });
      return enviar({ resultado:'liberado',mensagem:'Acesso liberado.' });
    };
    return checkin.realizarCheckin(req,res);
  }));
}

module.exports = registrar;
