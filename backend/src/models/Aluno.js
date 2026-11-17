const db = require('../config/database');

class Aluno {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf TEXT UNIQUE,
        telefone TEXT,
        email TEXT,
        data_nascimento TEXT,
        status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo', 'inadimplente')),
        foto TEXT,
        contato_emergencia TEXT,
        anamnese TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    db.run(sql, callback);
  }

  static create({ nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status = 'ativo' }, callback) {
    const sql = `INSERT INTO alunos (nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status], function (err) {
      callback(err, this);
    });
  }

  static listar(callback) {
    const sql = `SELECT * FROM alunos ORDER BY criado_em DESC`;
    db.all(sql, [], callback);
  }

  static findById(id, callback) {
    const sql = `SELECT * FROM alunos WHERE id = ?`;
    db.get(sql, [id], callback);
  }

  static atualizar(id, { nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status }, callback) {
    const sql = `UPDATE alunos SET nome = ?, cpf = ?, telefone = ?, email = ?, data_nascimento = ?, foto = ?, contato_emergencia = ?, anamnese = ?, status = ? WHERE id = ?`;
    db.run(sql, [nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status, id], callback);
  }

  static excluir(id, callback) {
    const sql = `DELETE FROM alunos WHERE id = ?`;
    db.run(sql, [id], callback);
  }
}

module.exports = Aluno;
