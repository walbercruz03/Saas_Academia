const db = require('../config/database');

const NivelDificuldade = {
  listar: ({ apenasAtivos = false, academia_id } = {}, callback) => {
    let sql = `
      SELECT
        n.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM niveis_dificuldade n
      LEFT JOIN modelos_treino mt ON mt.nivel_id = n.id AND mt.academia_id = ?
    `;

    const conditions = ["(n.academia_id IN (0, ?) OR n.academia_id IS NULL)"];
    if (apenasAtivos) {
      conditions.push(`n.ativo = 1`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` GROUP BY n.id ORDER BY n.ordem ASC, n.id ASC`;

    db.all(sql, [academia_id, academia_id], callback);
  },

  buscarPorId: (id, academiaId, callback) => {
    const sql = `
      SELECT
        n.*,
        COALESCE(COUNT(DISTINCT mt.id), 0) AS total_modelos
      FROM niveis_dificuldade n
      LEFT JOIN modelos_treino mt ON mt.nivel_id = n.id AND mt.academia_id = ?
      WHERE n.id = ? AND (n.academia_id IN (0, ?) OR n.academia_id IS NULL)
      GROUP BY n.id
    `;
    db.get(sql, [academiaId, id, academiaId], callback);
  },

  gerarSlug: (texto) => {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  criar: ({ nome, slug = null, ordem = 1, ativo = 1, academia_id }, callback) => {
    const slugFinal = slug && slug.trim() ? NivelDificuldade.gerarSlug(slug) : NivelDificuldade.gerarSlug(nome);
    const sql = `INSERT INTO niveis_dificuldade (nome, slug, ordem, ativo, academia_id) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [nome.trim(), slugFinal, Number(ordem || 1), ativo ? 1 : 0, academia_id], function (err) {
      if (err) return callback(err);
      NivelDificuldade.buscarPorId(this && this.lastID ? this.lastID : null, academia_id, callback);
    });
  },

  atualizar: (id, { nome, slug = null, ordem = 1, ativo = 1, academia_id }, callback) => {
    const slugFinal = slug && slug.trim() ? NivelDificuldade.gerarSlug(slug) : NivelDificuldade.gerarSlug(nome);
    const sql = `UPDATE niveis_dificuldade SET nome = ?, slug = ?, ordem = ?, ativo = ? WHERE id = ? AND academia_id = ?`;
    db.run(sql, [nome.trim(), slugFinal, Number(ordem || 1), ativo ? 1 : 0, id, academia_id], function (err) {
      if (err) return callback(err);
      if (!this.changes) return callback(null, null);
      NivelDificuldade.buscarPorId(id, academia_id, callback);
    });
  },

  deletar: (id, academiaId, callback) => {
    db.get(
      `SELECT COUNT(*) as total FROM modelos_treino WHERE nivel_id = ? AND academia_id = ?`,
      [id, academiaId],
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

        db.run(`DELETE FROM niveis_dificuldade WHERE id = ? AND academia_id = ?`, [id, academiaId], function (delErr) {
          if (delErr) return callback(delErr);
          callback(null, { deleted: true, changes: this?.changes || 0 });
        });
      }
    );
  },
};

module.exports = NivelDificuldade;
