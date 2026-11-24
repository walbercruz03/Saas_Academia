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

module.exports = {
  up: async (db) => {
    // 0. Garantir tabelas base de treinamento caso não existam
    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS grupos_musculares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS exercicios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        equipamento TEXT,
        dificuldade TEXT NOT NULL DEFAULT 'intermediario',
        imagem_url TEXT,
        video_url TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS exercicio_grupos_musculares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercicio_id INTEGER NOT NULL,
        grupo_muscular_id INTEGER NOT NULL,
        papel TEXT NOT NULL DEFAULT 'principal',
        FOREIGN KEY (exercicio_id) REFERENCES exercicios (id) ON DELETE CASCADE,
        FOREIGN KEY (grupo_muscular_id) REFERENCES grupos_musculares (id) ON DELETE CASCADE,
        UNIQUE (exercicio_id, grupo_muscular_id, papel)
      )
    `
    );

    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS modelos_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        divisao TEXT NOT NULL DEFAULT 'Treino A',
        nivel TEXT NOT NULL DEFAULT 'intermediario',
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS modelo_treino_exercicios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modelo_id INTEGER NOT NULL,
        exercicio_id INTEGER NOT NULL,
        ordem INTEGER NOT NULL DEFAULT 1,
        series TEXT NOT NULL DEFAULT '3',
        repeticoes TEXT NOT NULL DEFAULT '12',
        carga TEXT,
        descanso TEXT,
        observacao TEXT,
        FOREIGN KEY (modelo_id) REFERENCES modelos_treino (id) ON DELETE CASCADE,
        FOREIGN KEY (exercicio_id) REFERENCES exercicios (id) ON DELETE CASCADE
      )
    `
    );

    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS execucoes_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treino_id INTEGER,
        aluno_id INTEGER NOT NULL,
        data_execucao DATETIME DEFAULT CURRENT_TIMESTAMP,
        duracao_minutos INTEGER,
        percepcao_esforco INTEGER,
        observacao TEXT,
        cargas_json TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    // 1. Tabela modalidades
    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS modalidades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    // 2. Tabela niveis_dificuldade
    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS niveis_dificuldade (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        ordem INTEGER NOT NULL DEFAULT 1,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
    );

    // 3. Tabela divisoes_treino (permite divisões ilimitadas: Treino A, B, C...)
    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS divisoes_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        modelo_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        descricao TEXT,
        ordem INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (modelo_id) REFERENCES modelos_treino (id) ON DELETE CASCADE
      )
    `
    );

    // 4. Tabela aluno_modelos_treino (relação N:N compartilhada)
    await executar(
      db,
      `
      CREATE TABLE IF NOT EXISTS aluno_modelos_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        modelo_id INTEGER NOT NULL,
        data_inicio TEXT DEFAULT CURRENT_DATE,
        observacoes TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
        FOREIGN KEY (modelo_id) REFERENCES modelos_treino (id) ON DELETE RESTRICT,
        UNIQUE (aluno_id, modelo_id)
      )
    `
    );

    // 5. Garantir colunas em modelos_treino
    await garantirColuna(db, 'modelos_treino', 'modalidade_id', 'INTEGER');
    await garantirColuna(db, 'modelos_treino', 'nivel_id', 'INTEGER');
    await garantirColuna(db, 'modelos_treino', 'professor_id', 'INTEGER');
    await garantirColuna(db, 'modelos_treino', 'objetivo', 'TEXT');

    // 5.1 Garantir coluna instrucoes em exercicios
    await garantirColuna(db, 'exercicios', 'instrucoes', 'TEXT');

    // 6. Garantir coluna divisao_id em modelo_treino_exercicios
    await garantirColuna(db, 'modelo_treino_exercicios', 'divisao_id', 'INTEGER');

    // 7. Garantir colunas de imutabilidade e snapshot em execucoes_treino
    await garantirColuna(db, 'execucoes_treino', 'modelo_id', 'INTEGER');
    await garantirColuna(db, 'execucoes_treino', 'divisao_id', 'INTEGER');
    await garantirColuna(db, 'execucoes_treino', 'modelo_nome', 'TEXT');
    await garantirColuna(db, 'execucoes_treino', 'divisao_nome', 'TEXT');
    await garantirColuna(db, 'execucoes_treino', 'snapshot_treino_json', 'TEXT');

    // 8. Inserir modalidades padrão caso tabela esteja vazia
    const modalidadesExistentes = await buscarTodas(db, `SELECT COUNT(*) as total FROM modalidades`);
    const totalModalidades = Number(modalidadesExistentes[0]?.total || 0);

    if (totalModalidades === 0) {
      const padroesModalidades = [
        { nome: 'Musculação', descricao: 'Treinamento resistido com pesos e máquinas para hipertrofia e força' },
        { nome: 'Funcional', descricao: 'Treinamento de movimentos integrados e padrões corporais' },
        { nome: 'Cross Training', descricao: 'Treinamento de alta intensidade e condicionamento geral' },
        { nome: 'Pilates', descricao: 'Fortalecimento do core, estabilidade postural e respiração' },
        { nome: 'Treinamento Cardiovascular', descricao: 'Condicionamento aeróbico e resistência cardiorrespiratória' },
        { nome: 'Alongamento e Mobilidade', descricao: 'Melhora de flexibilidade, amplitude articular e prevenção de lesões' },
      ];

      for (const mod of padroesModalidades) {
        await executar(db, `INSERT INTO modalidades (nome, descricao, ativo) VALUES (?, ?, 1)`, [
          mod.nome,
          mod.descricao,
        ]);
      }
    }

    // 9. Inserir níveis de dificuldade padrão caso tabela esteja vazia
    const niveisExistentes = await buscarTodas(db, `SELECT COUNT(*) as total FROM niveis_dificuldade`);
    const totalNiveis = Number(niveisExistentes[0]?.total || 0);

    if (totalNiveis === 0) {
      const padroesNiveis = [
        { nome: 'Iniciante', slug: 'iniciante', ordem: 1 },
        { nome: 'Intermediário', slug: 'intermediario', ordem: 2 },
        { nome: 'Avançado', slug: 'avancado', ordem: 3 },
      ];

      for (const niv of padroesNiveis) {
        await executar(
          db,
          `INSERT INTO niveis_dificuldade (nome, slug, ordem, ativo) VALUES (?, ?, ?, 1)`,
          [niv.nome, niv.slug, niv.ordem]
        );
      }
    }

    // 10. Migração de compatibilidade para modelos existentes (criar divisoes_treino para modelos legados)
    const modelosExistentes = await buscarTodas(db, `SELECT * FROM modelos_treino`);
    for (const mod of modelosExistentes) {
      const divisoesDoModelo = await buscarTodas(
        db,
        `SELECT id FROM divisoes_treino WHERE modelo_id = ?`,
        [mod.id]
      );

      let divisaoPadraoId = divisoesDoModelo[0]?.id;

      if (!divisaoPadraoId) {
        const nomeDivisao = mod.divisao && String(mod.divisao).trim() ? String(mod.divisao).trim() : 'Treino A';
        const resNovaDiv = await executar(
          db,
          `INSERT INTO divisoes_treino (modelo_id, nome, descricao, ordem) VALUES (?, ?, ?, 1)`,
          [mod.id, nomeDivisao, 'Divisão principal']
        );
        divisaoPadraoId = resNovaDiv.lastID;
      }

      if (divisaoPadraoId) {
        // Atualiza exercícios que ficaram sem divisao_id vinculada
        await executar(
          db,
          `UPDATE modelo_treino_exercicios SET divisao_id = ? WHERE modelo_id = ? AND (divisao_id IS NULL OR divisao_id = 0)`,
          [divisaoPadraoId, mod.id]
        );
      }
    }
  },
};
