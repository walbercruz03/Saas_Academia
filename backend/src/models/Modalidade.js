const db = require('../config/database');

const Modalidade = {
  listar: ({ busca = '', apenasAtivos = false, academia_id } = {}, callback) => {
    const params = [academia_id, academia_id];
    let sql = `
      SELECT
        m.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM modalidades m
      LEFT JOIN modelos_treino mt ON mt.modalidade_id = m.id AND mt.academia_id = ?
    `;

    const conditions = ["(m.academia_id IN (0, ?) OR m.academia_id IS NULL)"];
    if (busca && busca.trim()) {
      const termo = `%${busca.trim()}%`;
      conditions.push(`(LOWER(m.nome) LIKE LOWER(?) OR LOWER(COALESCE(m.descricao, '')) LIKE LOWER(?))`);
      params.push(termo, termo);
    }

    if (apenasAtivos) {
      conditions.push(`m.ativo = 1`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` GROUP BY m.id ORDER BY m.nome ASC`;

    db.all(sql, params, callback);
  },

  buscarPorId: (id, academiaId, callback) => {
    const sql = `
      SELECT
        m.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM modalidades m
      LEFT JOIN modelos_treino mt ON mt.modalidade_id = m.id AND mt.academia_id = ?
      WHERE m.id = ? AND (m.academia_id IN (0, ?) OR m.academia_id IS NULL)
      GROUP BY m.id
    `;
    db.get(sql, [academiaId, id, academiaId], callback);
  },

  criar: ({ nome, descricao = null, ativo = 1, academia_id }, callback) => {
    const sql = `INSERT INTO modalidades (nome, descricao, ativo, academia_id) VALUES (?, ?, ?, ?)`;
    db.run(sql, [nome.trim(), descricao ? descricao.trim() : null, ativo ? 1 : 0, academia_id], function (err) {
      if (err) return callback(err);
      Modalidade.buscarPorId(this && this.lastID ? this.lastID : null, academia_id, callback);
    });
  },

  atualizar: (id, { nome, descricao = null, ativo = 1, academia_id }, callback) => {
    const sql = `UPDATE modalidades SET nome = ?, descricao = ?, ativo = ? WHERE id = ? AND academia_id = ?`;
    db.run(sql, [nome.trim(), descricao ? descricao.trim() : null, ativo ? 1 : 0, id, academia_id], function (err) {
      if (err) return callback(err);
      if (!this.changes) return callback(null, null);
      Modalidade.buscarPorId(id, academia_id, callback);
    });
  },

  deletar: (id, academiaId, callback) => {
    // Verifica vínculos ativos com modelos_treino
    db.get(
      `SELECT COUNT(*) as total FROM modelos_treino WHERE modalidade_id = ? AND academia_id = ?`,
      [id, academiaId],
      (err, row) => {
        if (err) return callback(err);
        const total = Number(row?.total || 0);
        if (total > 0) {
          const erroVinculo = new Error(
            `Não é possível excluir esta modalidade pois existem ${total} modelo(s) de treino vinculado(s). Desative-a ou altere os modelos primeiro.`
          );
          erroVinculo.status = 400;
          return callback(erroVinculo);
        }

        db.run(`DELETE FROM modalidades WHERE id = ? AND academia_id = ?`, [id, academiaId], function (delErr) {
          if (delErr) return callback(delErr);
          callback(null, { deleted: true, changes: this?.changes || 0 });
        });
      }
    );
  },
};

module.exports = Modalidade;
