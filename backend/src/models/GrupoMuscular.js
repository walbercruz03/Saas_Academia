const db = require('../config/database');

const GrupoMuscular = {
  criarTabela: (callback) => {
    const query = `
      CREATE TABLE IF NOT EXISTS grupos_musculares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        descricao TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    db.run(query, callback);
  },

  listar: ({ busca = '' } = {}, callback) => {
    const params = [];
    let sql = `
      SELECT
        gm.*,
        COALESCE(COUNT(DISTINCT CASE WHEN egm.papel = 'principal' THEN egm.exercicio_id END), 0) AS total_principais,
        COALESCE(COUNT(DISTINCT CASE WHEN egm.papel = 'secundario' THEN egm.exercicio_id END), 0) AS total_secundarios,
        COALESCE(COUNT(DISTINCT egm.exercicio_id), 0) AS total_exercicios
      FROM grupos_musculares gm
      LEFT JOIN exercicio_grupos_musculares egm ON egm.grupo_muscular_id = gm.id
    `;

    if (busca && busca.trim() !== '') {
      const termo = `%${busca.trim()}%`;
      sql += ` WHERE LOWER(gm.nome) LIKE LOWER(?) OR LOWER(COALESCE(gm.descricao, '')) LIKE LOWER(?)`;
      params.push(termo, termo);
    }

    sql += ` GROUP BY gm.id ORDER BY gm.nome ASC`;
    db.all(sql, params, callback);
  },

  buscarPorId: (id, callback) => {
    const sql = `SELECT * FROM grupos_musculares WHERE id = ?`;
    db.get(sql, [id], callback);
  },

  criar: ({ nome, descricao = null }, callback) => {
    const sql = `INSERT INTO grupos_musculares (nome, descricao) VALUES (?, ?)`;
    db.run(sql, [nome.trim(), descricao ? descricao.trim() : null], function (err) {
      if (err) return callback(err);
      callback(null, {
        id: this && this.lastID ? this.lastID : null,
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
      });
    });
  },

  atualizar: (id, { nome, descricao = null }, callback) => {
    const sql = `UPDATE grupos_musculares SET nome = ?, descricao = ? WHERE id = ?`;
    db.run(sql, [nome.trim(), descricao ? descricao.trim() : null, id], function (err) {
      if (err) return callback(err);
      callback(null, {
        id: Number(id),
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },

  deletar: (id, callback) => {
    const sql = `DELETE FROM grupos_musculares WHERE id = ?`;
    db.run(sql, [id], function (err) {
      if (err) return callback(err);
      callback(null, {
        deleted: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = GrupoMuscular;