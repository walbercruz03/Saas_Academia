const db = require('../config/database');
const bcrypt = require('bcryptjs');

class Usuario {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        idade INTEGER,
        cpf TEXT,
        email_ou_matricula TEXT UNIQUE NOT NULL,
        telefone TEXT,
        senha_hash TEXT NOT NULL,
        cargo TEXT NOT NULL CHECK(cargo IN ('admin', 'professor')),
        status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo')),
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (academia_id) REFERENCES academias(id)
      )
    `;
    db.run(sql, callback);
  }

  static create({ nome, idade, cpf, email_ou_matricula, telefone, senha, cargo, academia_id }, callback) {
    const senhaHash = bcrypt.hashSync(senha, 10);
    const sql = `INSERT INTO usuarios (nome, idade, cpf, email_ou_matricula, telefone, senha_hash, cargo, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [nome, idade, cpf, email_ou_matricula, telefone, senhaHash, cargo, academia_id], function (err) {
      callback(err, this);
    });
  }

  static findByEmailOuMatricula(email_ou_matricula, callback) {
    const sql = `SELECT * FROM usuarios WHERE email_ou_matricula = ?`;
    db.get(sql, [email_ou_matricula], callback);
  }

  static findById(id, callback) {
    const sql = `SELECT id, nome, idade, cpf, email_ou_matricula, telefone, cargo, status, academia_id, criado_em FROM usuarios WHERE id = ?`;
    db.get(sql, [id], callback);
  }

  static listar(callback) {
    const sql = `SELECT id, nome, idade, cpf, email_ou_matricula, telefone, cargo, status, academia_id, criado_em FROM usuarios ORDER BY criado_em DESC`;
    db.all(sql, [], callback);
  }

  static atualizarStatus(id, status, callback) {
    const sql = `UPDATE usuarios SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], callback);
  }

  static validarSenha(senha, senhaHash) {
    return bcrypt.compareSync(senha, senhaHash);
  }
}

module.exports = Usuario;
