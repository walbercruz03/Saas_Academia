const db = require('../config/database');
const bcrypt = require('bcryptjs');
const versaoSessao = () => db.isSqlite ? "'0'" : 'CAST(a.versao_sessao AS TEXT)';

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
    const sql = `
      SELECT u.*, ${versaoSessao()} AS versao_sessao,
        CASE WHEN a.ativo = 1 THEN 1 ELSE 0 END AS academia_ativa
      FROM usuarios u LEFT JOIN academias a ON a.id = u.academia_id
      WHERE u.email_ou_matricula = ?
    `;
    db.get(sql, [email_ou_matricula], callback);
  }

  static findById(id, callback) {
    const sql = `SELECT id, nome, idade, cpf, email_ou_matricula, telefone, cargo, status, academia_id, criado_em FROM usuarios WHERE id = ?`;
    db.get(sql, [id], callback);
  }

  static buscarSessao(id, callback) {
    const sql = `
      SELECT u.id, u.nome, u.email_ou_matricula, u.cargo, u.academia_id,
        CASE WHEN a.ativo = 1 THEN 1 ELSE 0 END AS academia_ativa,
        ${versaoSessao()} AS versao_sessao
      FROM usuarios u JOIN academias a ON a.id = u.academia_id
      WHERE u.id = ? AND u.academia_id > 0 AND u.status = 'ativo'
        AND u.cargo IN ('admin', 'professor')
    `;
    db.get(sql, [id], callback);
  }

  static listar(academiaId, callback) {
    const sql = `SELECT id, nome, idade, cpf, email_ou_matricula, telefone, cargo, status, academia_id, criado_em
      FROM usuarios WHERE academia_id = ? ORDER BY criado_em DESC`;
    db.all(sql, [academiaId], callback);
  }

  static atualizarStatus(id, status, academiaId, callback) {
    const sql = "UPDATE usuarios SET status = ? WHERE id = ? AND academia_id = ? AND cargo = 'professor'";
    db.run(sql, [status, id, academiaId], function (err) {
      callback(err, this?.changes);
    });
  }

  static validarSenha(senha, senhaHash) {
    return bcrypt.compareSync(senha, senhaHash);
  }
}

module.exports = Usuario;
