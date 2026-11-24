const path = require('path');

function executar(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this?.lastID, changes: this?.changes });
    });
  });
}

function buscarTodas(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function garantirColuna(db, tabela, coluna, tipoDef) {
  if (db.isSqlite) {
    const colunas = await buscarTodas(db, `PRAGMA table_info(${tabela})`);
    const existe = colunas.some((c) => {
      const colName = c.name || c.nome || c.column_name || '';
      return colName.toLowerCase() === coluna.toLowerCase();
    });
    if (!existe) {
      await executar(db, `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipoDef}`);
    }
  } else {
    await executar(db, `ALTER TABLE ${tabela} ADD COLUMN IF NOT EXISTS ${coluna} ${tipoDef}`);
  }
}

async function garantirTabelaMigracoesAcademia(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS _migracoes_academias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      executado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await executar(db, sql);
}

module.exports = {
  up: async (db) => {
    // 0. Garantir tabela de controle de migrações de academia
    await garantirTabelaMigracoesAcademia(db);
    // 1. Criar tabela de academias se não existir
    await executar(db, `
      CREATE TABLE IF NOT EXISTS academias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        cnpj TEXT UNIQUE,
        nome_fantasia TEXT,
        endereco TEXT,
        telefone TEXT,
        email TEXT,
        plano TEXT NOT NULL DEFAULT 'basico',
        limite_alunos INTEGER DEFAULT 100,
        limite_professores INTEGER DEFAULT 10,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[MIGRACOES] Tabela academias verificada/criada.');

    // 2. Adicionar academia_id em usuarios (se não existir)
    await garantirColuna(db, 'usuarios', 'academia_id', 'INTEGER');
    // 3. Adicionar academia_id em alunos (se não existir)
    await garantirColuna(db, 'alunos', 'academia_id', 'INTEGER');
    // 4. Adicionar academia_id em planos (se não existir)
    await garantirColuna(db, 'planos', 'academia_id', 'INTEGER');
    // 5. Adicionar academia_id em matriculas (se não existir)
    await garantirColuna(db, 'matriculas', 'academia_id', 'INTEGER');
    // 6. Adicionar academia_id em checkins (se não existir)
    await garantirColuna(db, 'checkins', 'academia_id', 'INTEGER');
    // 7. Adicionar academia_id em treinos (se não existir)
    await garantirColuna(db, 'treinos', 'academia_id', 'INTEGER');
    // 8. Adicionar academia_id em grupos_musculares (se não existir)
    await garantirColuna(db, 'grupos_musculares', 'academia_id', 'INTEGER');
    // 9. Adicionar academia_id em exercicios (se não existir)
    await garantirColuna(db, 'exercicios', 'academia_id', 'INTEGER');
    // 10. Adicionar academia_id em modalidades (se não existir)
    await garantirColuna(db, 'modalidades', 'academia_id', 'INTEGER');
    // 11. Adicionar academia_id em niveis_dificuldade (se não existir)
    await garantirColuna(db, 'niveis_dificuldade', 'academia_id', 'INTEGER');
    // 12. Adicionar academia_id em divisoes_treino (se não existir)
    await garantirColuna(db, 'divisoes_treino', 'academia_id', 'INTEGER');
    // 13. Adicionar academia_id em modelos_treino (se não existir)
    await garantirColuna(db, 'modelos_treino', 'academia_id', 'INTEGER');
    // 14. Adicionar academia_id em modelo_treino_exercicios (se não existir)
    await garantirColuna(db, 'modelo_treino_exercicios', 'academia_id', 'INTEGER');
    // 15. Adicionar academia_id em execucoes_treino (se não existir)
    await garantirColuna(db, 'execucoes_treino', 'academia_id', 'INTEGER');
    // 16. Adicionar academia_id em aluno_modelos_treino (se não existir)
    await garantirColuna(db, 'aluno_modelos_treino', 'academia_id', 'INTEGER');

    console.log('[MIGRACOES] Colunas academia_id adicionadas/verificadas em todas as tabelas.');
  },

  down: async (db) => {
    // Remover colunas academia_id em ordem reversa
    const tabelas = [
      'aluno_modelos_treino',
      'execucoes_treino',
      'modelo_treino_exercicios',
      'modelos_treino',
      'divisoes_treino',
      'niveis_dificuldade',
      'modalidades',
      'exercicios',
      'grupos_musculares',
      'treinos',
      'checkins',
      'matriculas',
      'planos',
      'alunos',
      'usuarios'
    ];

    for (const tabela of tabelas) {
      await executar(db, `ALTER TABLE ${tabela} DROP COLUMN IF EXISTS academia_id`);
    }

    // Dropar tabela academias por último
    await executar(db, `DROP TABLE IF EXISTS academias`);

    console.log('[MIGRACOES] Colunas academia_id removidas e tabela academias removida.');
  }
};