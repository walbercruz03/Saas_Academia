const express = require('express');
const autenticado = require('../middlewares/authMiddleware');
const administrador = require('../middlewares/isAdminMiddleware');
const evolucao = require('../services/evolucaoPortalAluno');
const execucoes = require('../services/execucaoPortalAluno');
const permissoes = require('../services/permissoesProfessor');
const portal = require('../services/portalAluno');
const { respostaPortal } = require('./portalAlunoRoutes');

const alunos = express.Router({ mergeParams:true });
const exercicios = express.Router({ mergeParams:true });

const conferirId = (req,res,next) => {
  if (!/^[1-9]\d{0,9}$/.test(req.params.id) || Number(req.params.id) > 2147483647) {
    return res.status(400).json({ mensagem:'Identificador inválido.' });
  }
  res.set('Cache-Control','no-store');
  return next();
};

function professorOuAdmin(req,res,next) {
  if (req.usuario.cargo === 'admin') return next();
  if (req.usuario.cargo === 'professor' &&
    permissoes.acesso(req.permissoesProfessor,'alunos','visualizar') &&
    permissoes.acesso(req.permissoesProfessor,'alunos','editar')) return next();
  return res.status(403).json({ mensagem:'Acesso restrito.' });
}

alunos.use(conferirId,autenticado);
alunos.get('/',professorOuAdmin,respostaPortal(async (req,res) =>
  res.json(await portal.estado(req.usuario.academia_id,req.params.id,req.usuario))));

alunos.put('/orientacao',professorOuAdmin,respostaPortal(async (req,res) => {
  const { objetivo, professor_id } = req.body || {};
  if (typeof objetivo !== 'string' || [...objetivo.trim()].length > 500 ||
      (professor_id != null && (!Number.isInteger(professor_id) || professor_id < 1 || professor_id > 2147483647))) {
    return res.status(400).json({ mensagem:'Confira o professor e o objetivo de até 500 caracteres.' });
  }
  await portal.orientacao(req.usuario.academia_id,req.params.id,req.usuario,objetivo.trim() || null,professor_id ?? null);
  return res.status(204).end();
}));

const acompanhar = (handler) => respostaPortal(async (req,res) => {
  await execucoes.pronto();
  const aluno = req.params.id;
  await execucoes.autorizarAcompanhamento(req.usuario,req.permissoesProfessor,aluno);
  return res.json(await handler(req.usuario.academia_id,aluno,req));
});

alunos.get('/evolucao',acompanhar((academia,aluno,req) =>
  evolucao.consultar(academia,aluno,req.query.periodo ?? '30',req.query.exercicio)));

alunos.put('/meta-semanal',professorOuAdmin,respostaPortal(async (req,res) => {
  await evolucao.salvarMeta(req.usuario,req.params.id,req.body?.meta_semanal);
  return res.status(204).end();
}));

alunos.get('/execucoes',acompanhar((academia,aluno,req) =>
  execucoes.listar(academia,aluno,req.query.pagina ?? '1',false)));
alunos.get('/execucoes/:sessao',acompanhar((academia,aluno,req) =>
  execucoes.consultar(academia,aluno,req.params.sessao,true)));

alunos.post('/acesso',administrador,respostaPortal(async (req,res) => {
  const { acao } = req.body || {};
  if (!['liberar','bloquear','recuperar'].includes(acao)) return res.status(400).json({ mensagem:'Ação inválida.' });
  return res.json(await portal.alterarAcesso(req.usuario.academia_id,req.params.id,acao));
}));

exercicios.use(conferirId,autenticado,administrador);
exercicios.get('/',respostaPortal(async (req,res) =>
  res.json(await portal.estadoImagem(req.usuario.academia_id,req.params.id))));

exercicios.put('/',respostaPortal(async (req,res) => {
  if (typeof req.body?.autorizada !== 'boolean') return res.status(400).json({ mensagem:'Confirme a autorização da imagem.' });
  await portal.autorizarImagem(req.usuario.academia_id,req.params.id,req.body.autorizada);
  return res.status(204).end();
}));

module.exports = { alunos, exercicios };
