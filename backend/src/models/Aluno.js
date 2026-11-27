const db = require('../config/database');

class Aluno {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cpf TEXT,
        telefone TEXT,
        email TEXT,
        data_nascimento TEXT,
        status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'inativo', 'inadimplente')),
        foto TEXT,
        contato_emergencia TEXT,
        anamnese TEXT,
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (academia_id, cpf),
        FOREIGN KEY (academia_id) REFERENCES academias(id)
      )
    `;
    db.run(sql, callback);
  }

  static create({ nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status = 'ativo', academia_id }, callback) {
    const sql = `INSERT INTO alunos (nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status, academia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [nome, cpf, telefone, email, data_nascimento, foto, contato_emergencia, anamnese, status, academia_id], function (err) {
      callback(err, this);
    });
  }

  static listar({ academia_id, resumo, incluirTelefone }, callback) {
    const campos = resumo ? `id, nome, cpf, status${incluirTelefone ? ', telefone' : ''}` : '*';
    const sql = `SELECT ${campos} FROM alunos WHERE academia_id = ? ORDER BY criado_em DESC`;
    db.leitor().all(sql, [academia_id], callback);
  }

  static buscarPorCpf(cpf, academiaId, callback) {
    const cpfNormalizado = db.isSqlite
      ? "replace(replace(replace(trim(cpf), '.', ''), '-', ''), ' ', '')"
      : "regexp_replace(cpf, '[^0-9]', '', 'g')";
    const sql = `SELECT id, nome, cpf, status, telefone FROM alunos
      WHERE academia_id = ? AND length(${cpfNormalizado}) = 11 AND ${cpfNormalizado} = ?`;
    db.leitor().get(sql, [academiaId, cpf], callback);
  }

  static findById(id, academiaId, callback, executor = db) {
    const sql = `SELECT * FROM alunos WHERE id = ? AND academia_id = ?`;
    executor.get(sql, [id, academiaId], callback);
  }

  static atualizar(id, dados, academiaId, callback) {
    const campos = ['nome', 'cpf', 'telefone', 'email', 'data_nascimento', 'foto', 'contato_emergencia', 'anamnese', 'status']
      .filter((campo) => dados[campo] !== undefined);
    const atribuicoes = campos.map((campo) => `${campo} = ?`).join(', ') || 'nome = nome';
    const sql = `UPDATE alunos SET ${atribuicoes} WHERE id = ? AND academia_id = ?`;
    db.run(sql, [...campos.map((campo) => dados[campo]), id, academiaId], callback);
  }

  static excluir(id, academiaId, callback) {
    const sql = `DELETE FROM alunos WHERE id = ? AND academia_id = ?`;
    db.run(sql, [id, academiaId], callback);
  }
}

module.exports = Aluno;
