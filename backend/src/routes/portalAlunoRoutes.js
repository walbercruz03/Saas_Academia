const express = require('express');
const portal = require('../services/portalAluno');
const evolucao = require('../services/evolucaoPortalAluno');
const execucoes = require('../services/execucaoPortalAluno');
const logotipo = require('../models/LogotipoAcademia');
const logFalha = require('../utils/logFalha');

const router = express.Router();
const nomeCookie = 'wcfit_aluno_sessao';
const cookie = { path: '/api/aluno', httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' };
const token = (req) => (req.headers.cookie || '').split(';').map((item) => item.trim())
  .find((item) => item.startsWith(nomeCookie + '='))?.slice(nomeCookie.length + 1);

function respostaPortal(handler) {
  return async (req,res,next) => {
    res.set('Cache-Control','no-store');
    try {
      await portal.pronto();
      return await handler(req,res,next);
    } catch (falha) {
      if ([400,401,403,404,409,429,503].includes(falha.status)) return res.status(falha.status).json({ mensagem:falha.message });
      logFalha('Falha no Portal do Aluno',falha);
      return res.status(503).json({ mensagem:'Portal do Aluno temporariamente indisponível.' });
    }
  };
}

async function autorizar(req,res,next) {
  req.alunoPortal = await portal.sessao(token(req));
  if (!req.alunoPortal) return res.status(401).json({ mensagem:'Entre no Portal do Aluno.' });
  return next();
}

router.use((_req,res,next) => {
  res.set('Cache-Control','no-store');
  next();
},express.json({ limit:'8kb' }));

for (const [rota,acao] of [['entrar',portal.entrar],['ativar',portal.ativar]]) {
  router.post('/' + rota,respostaPortal(async (req,res) => {
    const resultado = await acao(req.body || {},req.ip);
    if (resultado.academias) return res.json({ academias:resultado.academias });
    return res.cookie(nomeCookie,resultado.token,{ ...cookie,maxAge:portal.validadeSessao*1000 }).status(204).end();
  }));
}

router.post('/sair',respostaPortal(async (req,res) => {
  await portal.sair(token(req));
  return res.clearCookie(nomeCookie,cookie).status(204).end();
}));

router.get('/painel',respostaPortal(autorizar),respostaPortal(async (req,res) => res.json(await portal.painel(req.alunoPortal))));

const execucao = (handler) => respostaPortal(async (req,res) => {
  await execucoes.pronto();
  const dados = await handler(req,req.alunoPortal);
  return res.json(dados);
});

router.get('/evolucao',respostaPortal(autorizar),execucao((req,aluno) =>
  evolucao.consultar(aluno.academia_id,aluno.aluno_id,req.query.periodo ?? '30',req.query.exercicio)));

router.get('/execucoes',respostaPortal(autorizar),execucao((req,aluno) =>
  execucoes.listar(aluno.academia_id,aluno.aluno_id,req.query.pagina ?? '1',true)));
router.get('/execucoes/:id',respostaPortal(autorizar),execucao((req,aluno) =>
  execucoes.consultar(aluno.academia_id,aluno.aluno_id,req.params.id)));
router.post('/execucoes/iniciar',respostaPortal(autorizar),execucao((req,aluno) =>
  execucoes.iniciar(aluno,token(req),req.body?.ficha_id,req.body?.chave)));
router.post('/execucoes/:id',respostaPortal(autorizar),execucao((req,aluno) =>
  execucoes.atualizar(aluno,token(req),req.params.id,req.body || {})));

router.get('/logotipo',respostaPortal(autorizar),respostaPortal(async (req,res) => {
  if (!await logotipo.disponivel()) return res.status(404).end();
  const imagem = await logotipo.buscar(req.alunoPortal.academia_id);
  if (!imagem) return res.status(404).end();
  return res.set('X-Content-Type-Options','nosniff').type(imagem.mime).send(Buffer.from(imagem.conteudo));
}));

module.exports = { router, respostaPortal };
