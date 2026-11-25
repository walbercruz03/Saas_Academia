const readline = require('node:readline/promises');
const { execFileSync } = require('node:child_process');
const { MINIMO_SENHA, emailNormalizado, senhaValida, hashSenha } = require('../services/superAdminSeguranca');
const { MENSAGEM_SENHA } = require('../services/politicaSenha');

async function executar() {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY ||
      !process.env.DATABASE_URL || process.env.DB_CLIENT === 'sqlite' || process.env.USE_SQLITE === 'true') {
    throw new Error('Execute em um terminal confiável, sem argumentos, com DATABASE_URL configurada para PostgreSQL.');
  }
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const abortar = new AbortController();
  const interromper = () => abortar.abort();
  process.once('SIGINT', interromper);
  process.once('SIGTERM', interromper);
  let senha;
  let email;
  try {
    email = emailNormalizado(await terminal.question('E-mail do proprietário: ', { signal: abortar.signal }));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('E-mail inválido.');
    const modo = execFileSync('stty', ['-g'], { stdio: [0, 'pipe', 2], encoding: 'utf8' }).trim();
    try {
      execFileSync('stty', ['-echo'], { stdio: 'inherit' });
      senha = await terminal.question(`Senha (mínimo de ${MINIMO_SENHA} caracteres): `, { signal: abortar.signal });
      const confirmacao = await terminal.question('\nRepita a senha: ', { signal: abortar.signal });
      if (!senhaValida(senha)) throw new Error(`Senha inválida. ${MENSAGEM_SENHA}`);
      if (senha !== confirmacao) throw new Error('Senha e confirmação diferentes.');
    } finally {
      execFileSync('stty', [modo], { stdio: 'inherit' });
      process.stdout.write('\n');
    }
  } finally {
    terminal.close();
    process.removeListener('SIGINT', interromper);
    process.removeListener('SIGTERM', interromper);
  }
  const db = require('../config/database');
  try {
    await db.pronto;
    const { criarProprietario } = require('../models/SuperAdmin');
    if (db.isSqlite) throw new Error('PostgreSQL indisponível.');
    const criada = await criarProprietario(email, await hashSenha(senha));
    if (!criada) throw new Error('A conta inicial do proprietário já existe.');
    process.stdout.write('Conta criada. Configure o segundo fator no primeiro acesso.\n');
  } finally {
    await db.pool?.end();
  }
}

if (require.main === module) executar().catch((erro) => {
  // Erros de banco e do terminal podem conter detalhes de infraestrutura.
  console.error(erro.constructor === Error && /^(Execute|E-mail|Senha|PostgreSQL|A conta inicial)/.test(erro.message)
    ? erro.message : 'Não foi possível criar a conta inicial.');
  process.exitCode = 1;
});
