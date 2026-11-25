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

  listarTodos: (academiaId, callback) => {
    const query = `SELECT t.* FROM treinos t JOIN alunos a ON a.id = t.aluno_id
      WHERE a.academia_id = ? AND (t.academia_id = a.academia_id OR t.academia_id IS NULL) ORDER BY t.id DESC`;
    db.all(query, [academiaId], callback);
  },

  criar: (aluno_id, divisao, exercicios, academiaId, callback) => {
    const query = `INSERT INTO treinos (aluno_id, divisao, exercicios, academia_id)
      SELECT id, ?, ?, academia_id FROM alunos WHERE id = ? AND academia_id = ?`;
    db.run(query, [divisao, JSON.stringify(exercicios), aluno_id, academiaId], function(err) {
      if (err || !this.changes) return callback(err, null);
      callback(null, { id: this.lastID, aluno_id, divisao, exercicios });
    });
  },

  deletar: (id, academiaId, callback) => {
    const query = `DELETE FROM treinos WHERE id = ? AND (academia_id = ? OR academia_id IS NULL)
      AND aluno_id IN (SELECT id FROM alunos WHERE academia_id = ?)`;
    db.run(query, [id, academiaId, academiaId], callback);
  }
};

vif: Treino;
module.exports = Treino;