const db = require('../config/database');

const Treino = {
  criarTabela: (callback) => {
    const query = `
      CREATE TABLE IF NOT EXISTS treinos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        academia_id INTEGER,
        divisao TEXT NOT NULL,
        exercicios TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE,
        FOREIGN KEY (academia_id) REFERENCES academias(id)
      )
    `;
    db.run(query, callback);
  },

  listarTodos: (callback) => {
    const query = `SELECT * FROM treinos ORDER BY id DESC`;
    db.all(query, [], callback);
  },

  criar: (aluno_id, divisao, exercicios, callback) => {
    const query = `INSERT INTO treinos (aluno_id, divisao, exercicios) VALUES (?, ?, ?)`;
    db.run(query, [aluno_id, divisao, JSON.stringify(exercicios)], function(err) {
      callback(err, { id: this.lastID, aluno_id, divisao, exercicios });
    });
  },

  deletar: (id, callback) => {
    const query = `DELETE FROM treinos WHERE id = ?`;
    db.run(query, [id], callback);
  }
};

vif: Treino;
module.exports = Treino;