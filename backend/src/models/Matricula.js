const db = require('../config/database');

class Matricula {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS matriculas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        plano_id INTEGER NOT NULL,
        data_inicio TEXT NOT NULL,
        data_vencimento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'vencido', 'cancelado')),
        valor_pago REAL NOT NULL DEFAULT 0,
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos(id),
        FOREIGN KEY (plano_id) REFERENCES planos(id)
      )
    `;
    db.run(sql, callback);
  }

  static create({ aluno_id, plano_id, data_inicio, data_vencimento, status = 'ativo', valor_pago = 0, academia_id }, callback) {
    const sql = `INSERT INTO matriculas (aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, academia_id], function (err) {
      callback(err, this);
    });
  }

  static listar({ academia_id }, callback) {
    const conditions = academia_id ? `WHERE m.academia_id = ?` : '';
    const params = academia_id ? [academia_id] : [];
    const sql = `
      SELECT m.*, a.nome as aluno_nome, p.nome as plano_nome, p.preco as plano_preco
      FROM matriculas m
      JOIN alunos a ON m.aluno_id = a.id
      JOIN planos p ON m.plano_id = p.id ${conditions ? 'AND m.academia_id = p.academia_id' : ''}
      ORDER BY m.criado_em DESC
    `;
    db.all(sql, params, callback);
  }

  static findById(id, callback) {
    const sql = `SELECT * FROM matriculas WHERE id = ?`;
    db.get(sql, [id], callback);
  }

  static atualizar(id, { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago }, callback) {
    const sql = `UPDATE matriculas SET aluno_id = ?, plano_id = ?, data_inicio = ?, data_vencimento = ?, status = ?, valor_pago = ? WHERE id = ?`;
    db.run(sql, [aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, id], callback);
  }

  static excluir(id, callback) {
    const sql = `DELETE FROM matriculas WHERE id = ?`;
    db.run(sql, [id], callback);
  }
}

module.exports = Matricula;
