const db = require('../config/database');

const modulos = {
  alunos: 'Alunos', planos: 'Planos', matriculas: 'Matrículas', checkin: 'Check-in',
  relatorios: 'Dashboard e relatórios operacionais', treinos: 'Treinos', exercicios: 'Exercícios',
  modelos: 'Modelos de treino', catalogo: 'Configuração de treinamento', execucoes: 'Acompanhamento',
  saude: 'Anamnese e contato de emergência',
};
const acoes = ['visualizar', 'criar', 'editar', 'excluir'];
const porModulo = {
  alunos: ['visualizar','criar','editar'], planos: ['visualizar'], matriculas: ['visualizar'],
  checkin: ['visualizar','criar'], relatorios: ['visualizar'], treinos: ['visualizar','criar','excluir'],
  exercicios: acoes, modelos: acoes, catalogo: acoes, execucoes: ['visualizar','criar','excluir'],
  saude: ['visualizar','criar','editar'],
};
const rotas = {
  alunos:'alunos', planos:'planos', matriculas:'matriculas', checkin:'checkin', relatorios:'relatorios',
  treinos:'treinos', exercicios:'exercicios', 'modelos-treino':'modelos', 'execucoes-treino':'execucoes',
  'grupos-musculares':'catalogo', modalidades:'catalogo', 'niveis-dificuldade':'catalogo',
};
const porMetodo = { GET:'visualizar', HEAD:'visualizar', POST:'criar', PUT:'editar', PATCH:'editar', DELETE:'excluir' };

async function disponivel(executor = db.pool) {
  if (!executor || db.isSqlite) return false;
  return (await executor.query("SELECT to_regclass('public.professor_permissoes') IS NOT NULL AS pronta")).rows[0].pronta;
}

async function obter(usuario) {
  if (!await disponivel()) return null;
  const { rows: [linha] } = await db.pool.query(
    'SELECT permissoes FROM professor_permissoes WHERE usuario_id=$1 AND academia_id=$2', [usuario.id,usuario.academia_id]);
  return linha?.permissoes ?? null;
}

function acesso(regras, modulo, acao) {
  return regras === null || (Array.isArray(regras?.[modulo]) && regras[modulo].includes(acao));
}

function autorizar(req, regras) {
  const raiz = req.baseUrl.split('/').at(-1);
  if (raiz === 'financeiro') return false;
  const modulo = rotas[raiz];
  if (!modulo) return true;
  const consultaCpf = (raiz === 'alunos' && req.route?.path === '/buscar-cpf') ||
    (raiz === 'checkin' && req.route?.path === '/buscar-aluno');
  if (consultaCpf && req.method === 'POST') return acesso(regras, modulo, 'visualizar');
  if (!acesso(regras, modulo, porMetodo[req.method])) return false;
  if (raiz === 'alunos') {
    const acao = porMetodo[req.method];
    if (req.path.includes('/modelos-treino')) return acesso(regras, 'modelos', acao);
    if (req.body && ['criar','editar'].includes(acao)) {
      if (['anamnese','contato_emergencia'].some((campo) => Object.hasOwn(req.body,campo))) {
        if (!acesso(regras,'saude',acao) || !acesso(regras,'saude','visualizar')) return false;
      }
      if (Object.hasOwn(req.body,'modelos_ids') && !acesso(regras,'modelos',acao)) return false;
    }
  }
  return true;
}

function validar(regras) {
  if (!regras || typeof regras !== 'object' || Array.isArray(regras)) return false;
  return Object.entries(regras).every(([modulo, permitidas]) => Object.hasOwn(modulos,modulo) &&
    Array.isArray(permitidas) && permitidas.length <= 4 && new Set(permitidas).size === permitidas.length &&
    permitidas.every((acao) => porModulo[modulo].includes(acao)));
}

module.exports = { modulos, porModulo, disponivel, obter, acesso, autorizar, validar };
