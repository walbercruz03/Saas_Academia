const db = require('../config/database');

class Checkin {
  static buscarPolitica(academiaId, callback, executor = db) {
    if (db.isSqlite) return callback(null, null);
    // A ausência da migration mantém desativado o bloqueio durante a implantação.
    executor.get(`
      SELECT (to_jsonb(a)->>'bloquear_checkin_inadimplencia')::boolean AS bloqueio,
        (to_jsonb(a)->>'tolerancia_inadimplencia_dias')::integer AS tolerancia_dias
      FROM academias a WHERE a.id = ?
    `, [academiaId], callback);
  }

  static salvarPolitica(academiaId, bloqueio, toleranciaDias, callback) {
    db.get(`
      UPDATE academias SET bloquear_checkin_inadimplencia = ?, tolerancia_inadimplencia_dias = ?
      WHERE id = ? AND ativo = 1
      RETURNING bloquear_checkin_inadimplencia AS bloqueio, tolerancia_inadimplencia_dias AS tolerancia_dias
    `, [bloqueio, toleranciaDias, academiaId], callback);
  }

  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        data_checkin DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'presente' CHECK(status IN ('presente', 'ausente')),
        observacoes TEXT,
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos(id)
      )
    `;
    db.run(sql, callback);
  }

  static buscarMatriculas(alunoId, academiaId, callback, executor = db) {
    const sql = `SELECT m.id, m.status, m.data_inicio, m.data_vencimento,
      a.status AS aluno_status, p.id AS plano_valido
      FROM matriculas m
      JOIN alunos a ON a.id = m.aluno_id AND a.academia_id = m.academia_id
      JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
      WHERE m.aluno_id = ? AND m.academia_id = ? AND m.status = 'ativo'`;
    executor.all(sql, [alunoId, academiaId], callback);
  }

  static create({ aluno_id, status, observacoes, academia_id, matricula }, callback, executor = db) {
    // Compara a matrícula verificada com o registro atual na própria instrução de escrita.
    const sql = `
      INSERT INTO checkins (aluno_id, status, observacoes, academia_id)
      SELECT a.id, ?, ?, a.academia_id FROM alunos a
      JOIN academias ac ON ac.id = a.academia_id AND ac.ativo = 1
      WHERE a.id = ? AND a.academia_id = ? AND a.status IN ('ativo', 'inadimplente')
      AND EXISTS (
        SELECT 1 FROM matriculas m
        JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
        WHERE m.id = ? AND m.aluno_id = a.id AND m.academia_id = a.academia_id
          AND m.status = 'ativo' AND m.data_inicio = ? AND m.data_vencimento = ?
      )
    `;
    const params = [status, observacoes, aluno_id, academia_id, matricula.id, matricula.data_inicio, matricula.data_vencimento];
    executor.run(sql, params, function (err) {
      callback(err, this);
    });
  }

  static listar({ academia_id, pagina }, callback) {
    const tamanho = 50;
    const sql = `
      SELECT c.*, a.nome as aluno_nome, a.cpf as aluno_cpf
      FROM checkins c
      JOIN alunos a ON c.aluno_id = a.id AND c.academia_id = a.academia_id
      WHERE c.academia_id = ?
      ORDER BY c.data_checkin DESC${pagina ? ', c.id DESC LIMIT ? OFFSET ?' : ''}
    `;
    if (pagina === undefined) return db.all(sql, [academia_id], callback);
    db.leitor().all(sql, [academia_id, tamanho + 1, (pagina - 1) * tamanho], (erro, rows) => {
      if (erro) return callback(erro);
      callback(null, { registros: rows.slice(0, tamanho), pagina, temMais: rows.length > tamanho });
    });
  }

  static buscarAlunoPorCpf(cpf, callback) {
    const sql = `SELECT * FROM alunos WHERE cpf = ?`;
    db.get(sql, [cpf], callback);
  }

  static buscarAlunoPorId(id, callback) {
    const sql = `SELECT * FROM alunos WHERE id = ?`;
    db.get(sql, [id], callback);
  }
}

module.exports = Checkin;
