const fs = require('fs');
const path = require('path');
const db = require('../config/database');

function executarConsulta(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this?.lastID, changes: this?.changes });
    });
  });
}

function buscarTodas(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function garantirTabelaMigracoes() {
  const sql = `
    CREATE TABLE IF NOT EXISTS _migracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      executado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await executarConsulta(sql);
}

async function executarMigracoes() {
  await garantirTabelaMigracoes();

  const migracoesExecutadasRows = await buscarTodas(`SELECT nome FROM _migracoes`);
  const executadas = new Set(migracoesExecutadasRows.map((r) => r.nome));

  const diretorioMigracoes = __dirname;
  const arquivos = fs
    .readdirSync(diretorioMigracoes)
    .filter((f) => f.endsWith('.js') && f !== 'runner.js')
    .sort();

  for (const arquivo of arquivos) {
    if (executadas.has(arquivo)) {
      continue;
    }

    console.log(`[MIGRAÇÕES] Executando migração: ${arquivo}...`);
    const migracao = require(path.join(diretorioMigracoes, arquivo));

    if (typeof migracao.up !== 'function') {
      throw new Error(`Migração ${arquivo} não exporta o método "up".`);
    }

    await migracao.up(db);
    await executarConsulta(`INSERT INTO _migracoes (nome) VALUES (?)`, [arquivo]);
    console.log(`[MIGRAÇÕES] Migração ${arquivo} concluída com sucesso.`);
  }

  return { sucesso: true, total: arquivos.length };
}

if (require.main === module) {
  executarMigracoes()
    .then(() => {
      console.log('[MIGRAÇÕES] Todas as migrações foram executadas com sucesso.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[MIGRAÇÕES] Erro ao executar migrações:', err);
      process.exit(1);
    });
}

module.exports = {
  executarMigracoes,
};
