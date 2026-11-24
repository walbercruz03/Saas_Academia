const db = require('../config/database');

const NivelDificuldade = {
  listar: ({ apenasAtivos = false } = {}, callback) => {
    let sql = `
      SELECT
        n.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM niveis_dificuldade n
      LEFT JOIN modelos_treino mt ON mt.nivel_id = n.id
    `;

    const conditions = [];
    if (apenasAtivos) {
      conditions.push(`n.ativo = 1`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` GROUP BY n.id ORDER BY n.ordem ASC, n.id ASC`;

    db.all(sql, [], callback);
  },

  buscarPorId: (id, callback) => {
    const sql = `
      SELECT
        n.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM niveis_dificuldade n
      LEFT JOIN modelos_treino mt ON mt.nivel_id = n.id
      WHERE n.id = ?
      GROUP BY n.id
    `;
    db.get(sql, [id], callback);
  },

  gerarSlug: (texto) => {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  criar: ({ nome, slug = null, ordem = 1, ativo = 1 }, callback) => {
    const slugFinal = slug && slug.trim() ? NivelDificuldade.gerarSlug(slug) : NivelDificuldade.gerarSlug(nome);
    const sql = `INSERT INTO niveis_dificuldade (nome, slug, ordem, ativo) VALUES (?, ?, ?, ?)`;
    db.run(sql, [nome.trim(), slugFinal, Number(ordem || 1), ativo ? 1 : 0], function (err) {
      if (err) return callback(err);
      NivelDificuldade.buscarPorId(this && this.lastID ? this.lastID : null, callback);
    });
  },

  atualizar: (id, { nome, slug = null, ordem = 1, ativo = 1 }, callback) => {
    const slugFinal = slug && slug.trim() ? NivelDificuldade.gerarSlug(slug) : NivelDificuldade.gerarSlug(nome);
    const sql = `UPDATE niveis_dificuldade SET nome = ?, slug = ?, ordem = ?, ativo = ? WHERE id = ?`;
    db.run(sql, [nome.trim(), slugFinal, Number(ordem || 1), ativo ? 1 : 0, id], function (err) {
      if (err) return callback(err);
      NivelDificuldade.buscarPorId(id, callback);
    });
  },

  deletar: (id, callback) => {
    db.get(
      `SELECT COUNT(*) as total FROM modelos_treino WHERE nivel_id = ?`,
      [id],
      (err, row) => {
        if (err) return callback(err);
        const total = Number(row?.total || 0);
        if (total > 0) {
          const erroVinculo = new Error(
            `Não é possível excluir este nível de dificuldade pois existem ${total} modelo(s) de treino vinculado(s). Desative-o ou altere os modelos primeiro.`
          );
          erroVinculo.status = 400;
          return callback(erroVinculo);
        }

        db.run(`DELETE FROM niveis_dificuldade WHERE id = ?`, [id], function (delErr) {
          if (delErr) return callback(delErr);
          callback(null, { deleted: true, changes: this?.changes || 0 });
        });
      }
    );
  },
};

module.exports = NivelDificuldade;
