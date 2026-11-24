const db = require('../config/database');

const Modalidade = {
  listar: ({ busca = '', apenasAtivos = false } = {}, callback) => {
    const params = [];
    let sql = `
      SELECT
        m.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM modalidades m
      LEFT JOIN modelos_treino mt ON mt.modalidade_id = m.id
    `;

    const conditions = [];
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

  buscarPorId: (id, callback) => {
    const sql = `
      SELECT
        m.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM modalidades m
      LEFT JOIN modelos_treino mt ON mt.modalidade_id = m.id
      WHERE m.id = ?
      GROUP BY m.id
    `;
    db.get(sql, [id], callback);
  },

  criar: ({ nome, descricao = null, ativo = 1 }, callback) => {
    const sql = `INSERT INTO modalidades (nome, descricao, ativo) VALUES (?, ?, ?)`;
    db.run(sql, [nome.trim(), descricao ? descricao.trim() : null, ativo ? 1 : 0], function (err) {
      if (err) return callback(err);
      Modalidade.buscarPorId(this && this.lastID ? this.lastID : null, callback);
    });
  },

  atualizar: (id, { nome, descricao = null, ativo = 1 }, callback) => {
    const sql = `UPDATE modalidades SET nome = ?, descricao = ?, ativo = ? WHERE id = ?`;
    db.run(sql, [nome.trim(), descricao ? descricao.trim() : null, ativo ? 1 : 0, id], function (err) {
      if (err) return callback(err);
      Modalidade.buscarPorId(id, callback);
    });
  },

  deletar: (id, callback) => {
    // Verifica vínculos ativos com modelos_treino
    db.get(
      `SELECT COUNT(*) as total FROM modelos_treino WHERE modalidade_id = ?`,
      [id],
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

        db.run(`DELETE FROM modalidades WHERE id = ?`, [id], function (delErr) {
          if (delErr) return callback(delErr);
          callback(null, { deleted: true, changes: this?.changes || 0 });
        });
      }
    );
  },
};

module.exports = Modalidade;
