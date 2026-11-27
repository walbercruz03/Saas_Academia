const path = require('node:path');

async function up(db) {
  if (!db.isSqlite) return;

  const sqlite = require('sqlite3');
  const banco = new sqlite.Database(path.join(__dirname, '..', 'database.sqlite'));
  const consultar = (sql) => new Promise((resolve, reject) => {
    banco.all(sql, (erro, linhas) => erro ? reject(erro) : resolve(linhas));
  });
  const executar = (sql) => new Promise((resolve, reject) => {
    banco.exec(sql, (erro) => erro ? reject(erro) : resolve());
  });

  try {
    await executar('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;');
    const esquema = await consultar(`
      SELECT type, sql FROM sqlite_master WHERE tbl_name='alunos' AND sql IS NOT NULL
    `);
    const tabela = esquema.find(({ type }) => type === 'table')?.sql;
    if (!tabela) throw new Error('Tabela de alunos indisponível.');
    if (/\bcpf\s+TEXT\s+UNIQUE\b/i.test(tabela)) {
      const sequencia = (await consultar("SELECT seq FROM sqlite_sequence WHERE name='alunos'"))[0]?.seq ?? 0;
      const novaTabela = tabela.replace(/^CREATE TABLE (?:IF NOT EXISTS )?["\x60\[]?alunos["\x60\]]?\s*\(/i,
        'CREATE TABLE alunos_cpf_novo (').replace(/\bcpf\s+TEXT\s+UNIQUE\b/i, 'cpf TEXT');
      await executar(`
        ${novaTabela};
        INSERT INTO alunos_cpf_novo SELECT * FROM alunos;
        DROP TABLE alunos;
        ALTER TABLE alunos_cpf_novo RENAME TO alunos;
        INSERT INTO sqlite_sequence (name,seq)
        SELECT 'alunos',${Number(sequencia)} WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name='alunos');
        UPDATE sqlite_sequence SET seq=max(seq,${Number(sequencia)}) WHERE name='alunos';
        ${esquema.filter(({ type }) => type !== 'table').map(({ sql }) => sql + ';').join('\n')}
      `);
    }

    const conflito = `
      SELECT 1 FROM alunos a WHERE a.academia_id=NEW.academia_id
        AND replace(replace(replace(trim(a.cpf),'.',''),'-',''),' ','')=NEW.cpf
    `;
    await executar(`
      CREATE TRIGGER IF NOT EXISTS alunos_cpf_inserir BEFORE INSERT ON alunos
      WHEN EXISTS (${conflito})
      BEGIN SELECT RAISE(ABORT,'CPF duplicado na academia'); END;
      CREATE TRIGGER IF NOT EXISTS alunos_cpf_atualizar BEFORE UPDATE OF cpf ON alunos
      WHEN NEW.cpf IS NOT OLD.cpf AND EXISTS (${conflito} AND a.id<>OLD.id)
      BEGIN SELECT RAISE(ABORT,'CPF duplicado na academia'); END;
      COMMIT;
    `);
  } catch (erro) {
    await executar('ROLLBACK;').catch(() => {});
    throw erro;
  } finally {
    await new Promise((resolve, reject) => banco.close((erro) => erro ? reject(erro) : resolve()));
  }
}

module.exports = { up };
