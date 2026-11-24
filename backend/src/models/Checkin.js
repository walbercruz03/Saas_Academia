const db = require('../config/database');

class Checkin {
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

  static create({ aluno_id, status = 'presente', observacoes, academia_id }, callback) {
    const sql = `INSERT INTO checkins (aluno_id, status, observacoes, academia_id) VALUES (?, ?, ?, ?)`;
    db.run(sql, [aluno_id, status, observacoes, academia_id], function (err) {
      callback(err, this);
    });
  }

  static listar({ academia_id }, callback) {
    const conditions = academia_id ? `WHERE c.academia_id = ?` : '';
    const params = academia_id ? [academia_id] : [];
    const sql = `
      SELECT c.*, a.nome as aluno_nome, a.cpf as aluno_cpf
      FROM checkins c
      JOIN alunos a ON c.aluno_id = a.id ${conditions ? 'AND c.academia_id = a.academia_id' : ''}
      ORDER BY c.data_checkin DESC
    `;
    db.all(sql, params, callback);
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
