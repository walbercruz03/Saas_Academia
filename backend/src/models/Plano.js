const db = require('../config/database');

class Plano {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS planos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL DEFAULT 0,
        duracao_meses INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'vencido', 'cancelado')),
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (academia_id) REFERENCES academias(id)
      )
    `;
    db.run(sql, callback);
  }

  static create({ nome, descricao, preco, duracao_meses, status, academia_id }, callback) {
    const sql = `INSERT INTO planos (nome, descricao, preco, duracao_meses, status, academia_id) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [nome, descricao, preco, duracao_meses, status, academia_id], function (err) {
      callback(err, this);
    });
  }

  static listar({ academia_id }, callback) {
    const sql = `SELECT * FROM planos WHERE academia_id = ? ORDER BY criado_em DESC`;
    db.all(sql, [academia_id], callback);
  }

  static findById(id, academiaId, callback) {
    const sql = `SELECT * FROM planos WHERE id = ? AND academia_id = ?`;
    db.get(sql, [id, academiaId], callback);
  }

  static atualizar(id, { nome, descricao, preco, duracao_meses, status }, academiaId, callback) {
    const sql = `UPDATE planos SET nome = ?, descricao = ?, preco = ?, duracao_meses = ?, status = ? WHERE id = ? AND academia_id = ?`;
    db.run(sql, [nome, descricao, preco, duracao_meses, status, id, academiaId], callback);
  }

  static excluir(id, academiaId, callback) {
    const sql = `DELETE FROM planos WHERE id = ? AND academia_id = ?`;
    db.run(sql, [id, academiaId], callback);
  }
}

module.exports = Plano;
