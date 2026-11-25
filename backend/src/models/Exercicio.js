const db = require('../config/database');

const Exercicio = {
  criarTabela: (callback) => {
    const query = `
      CREATE TABLE IF NOT EXISTS exercicios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        equipamento TEXT,
        dificuldade TEXT NOT NULL DEFAULT 'intermediario',
        imagem_url TEXT,
        video_url TEXT,
        ativo INTEGER NOT NULL DEFAULT 1,
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (academia_id) REFERENCES academias(id)
      )
    `;
    db.run(query, (err) => {
      if (err) return callback(err);

      const joinQuery = `
        CREATE TABLE IF NOT EXISTS exercicio_grupos_musculares (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercicio_id INTEGER NOT NULL,
          grupo_muscular_id INTEGER NOT NULL,
          papel TEXT NOT NULL DEFAULT 'principal',
          FOREIGN KEY (exercicio_id) REFERENCES exercicios (id) ON DELETE CASCADE,
          FOREIGN KEY (grupo_muscular_id) REFERENCES grupos_musculares (id) ON DELETE CASCADE,
          UNIQUE (exercicio_id, grupo_muscular_id, papel)
        )
      `;
      db.run(joinQuery, callback);
    });
  },

  sincronizarGrupos: (exercicioId, gruposPrincipais = [], gruposSecundarios = [], callback) => {
    const principaisIds = [...new Set((gruposPrincipais || []).map(Number).filter(Boolean))];
    const secundariosIds = [...new Set((gruposSecundarios || []).map(Number).filter(Boolean))];

    db.run(`DELETE FROM exercicio_grupos_musculares WHERE exercicio_id = ?`, [exercicioId], (err) => {
      if (err) return callback(err);

      const itens = [
        ...principaisIds.map((grupoId) => ({ grupoId, papel: 'principal' })),
        ...secundariosIds.map((grupoId) => ({ grupoId, papel: 'secundario' })),
      ];

      if (itens.length === 0) return callback(null);

      let concluídos = 0;
      let falhou = false;

      itens.forEach((item) => {
        if (falhou) return;
        db.run(
          `INSERT INTO exercicio_grupos_musculares (exercicio_id, grupo_muscular_id, papel) VALUES (?, ?, ?)`,
          [exercicioId, item.grupoId, item.papel],
          (insertErr) => {
            if (falhou) return;
            if (insertErr) {
              falhou = true;
              return callback(insertErr);
            }
            concluídos += 1;
            if (concluídos === itens.length) {
              callback(null);
            }
          }
        );
      });
    });
  },

  anexarGrupos: (exercicios, callback) => {
    if (!Array.isArray(exercicios) || exercicios.length === 0) {
      return callback(null, []);
    }

    const ids = exercicios.map((e) => e.id);
    const placeholders = ids.map(() => '?').join(', ');

    const sql = `
      SELECT
        egm.exercicio_id,
        egm.papel,
        gm.id AS grupo_id,
        gm.nome AS grupo_nome
      FROM exercicio_grupos_musculares egm
      INNER JOIN exercicios e ON e.id = egm.exercicio_id
      INNER JOIN grupos_musculares gm ON gm.id = egm.grupo_muscular_id AND gm.academia_id IN (0, e.academia_id)
      WHERE egm.exercicio_id IN (${placeholders})
      ORDER BY gm.nome ASC
    `;

    db.all(sql, ids, (err, vinculos) => {
      if (err) return callback(err);

      const mapa = new Map();
      exercicios.forEach((ex) => {
        mapa.set(ex.id, {
          ...ex,
          grupos_principais: [],
          grupos_secundarios: [],
        });
      });

      (vinculos || []).forEach((v) => {
        const alvo = mapa.get(v.exercicio_id);
        if (!alvo) return;
        const grupoObj = { id: v.grupo_id, nome: v.grupo_nome, papel: v.papel };
        if (v.papel === 'secundario') {
          alvo.grupos_secundarios.push(grupoObj);
        } else {
          alvo.grupos_principais.push(grupoObj);
        }
      });

      callback(null, Array.from(mapa.values()));
    });
  },

  listar: ({ busca = '', equipamento = '', dificuldade = '', grupoMuscularId = '', apenasAtivos = false, academia_id } = {}, callback) => {
    const params = [academia_id];
    const conditions = ['e.academia_id IN (0, ?)'];

    let sql = `SELECT DISTINCT e.* FROM exercicios e`;

    if (grupoMuscularId && String(grupoMuscularId).trim() !== '') {
      sql += ` INNER JOIN exercicio_grupos_musculares egm_filtro ON egm_filtro.exercicio_id = e.id`;
      conditions.push(`egm_filtro.grupo_muscular_id IN (SELECT id FROM grupos_musculares WHERE id = ? AND academia_id IN (0, e.academia_id))`);
      params.push(Number(grupoMuscularId));
    }

    if (busca && busca.trim() !== '') {
      const termo = `%${busca.trim()}%`;
      conditions.push(`(LOWER(e.nome) LIKE LOWER(?) OR LOWER(COALESCE(e.descricao, '')) LIKE LOWER(?) OR LOWER(COALESCE(e.equipamento, '')) LIKE LOWER(?))`);
      params.push(termo, termo, termo);
    }

    if (equipamento && equipamento.trim() !== '') {
      conditions.push(`LOWER(COALESCE(e.equipamento, '')) LIKE LOWER(?)`);
      params.push(`%${equipamento.trim()}%`);
    }

    if (dificuldade && dificuldade.trim() !== '') {
      conditions.push(`LOWER(e.dificuldade) = LOWER(?)`);
      params.push(dificuldade.trim());
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY e.nome ASC, e.id DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return callback(err);
      Exercicio.anexarGrupos(rows || [], callback);
    });
  },

  buscarPorId: (id, academiaId, callback) => {
    db.get(`SELECT * FROM exercicios WHERE id = ? AND academia_id IN (0, ?)`, [id, academiaId], (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, null);
      Exercicio.anexarGrupos([row], (grupoErr, lista) => {
        if (grupoErr) return callback(grupoErr);
        callback(null, lista[0] || null);
      });
    });
  },

  criar: (dados, callback) => {
    const {
      nome,
      descricao = null,
      instrucoes = null,
      equipamento = null,
      dificuldade = 'intermediario',
      imagem_url = null,
      video_url = null,
      ativo = 1,
      academia_id,
      grupos_principais = [],
      grupos_secundarios = [],
    } = dados;

    const sql = `
      INSERT INTO exercicios (nome, descricao, instrucoes, equipamento, dificuldade, imagem_url, video_url, ativo, academia_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nome.trim(),
      descricao ? descricao.trim() : null,
      instrucoes ? instrucoes.trim() : null,
      equipamento ? equipamento.trim() : null,
      dificuldade || 'intermediario',
      imagem_url ? imagem_url.trim() : null,
      video_url ? video_url.trim() : null,
      ativo === false || ativo === 0 ? 0 : 1,
      academia_id,
    ];

    db.run(sql, params, function (err) {
      if (err) return callback(err);
      const novoId = this && this.lastID ? this.lastID : null;
      if (!novoId) return callback(new Error('Não foi possível obter o ID do exercício criado.'));

      Exercicio.sincronizarGrupos(novoId, grupos_principais, grupos_secundarios, (syncErr) => {
        if (syncErr) return callback(syncErr);
        Exercicio.buscarPorId(novoId, academia_id, callback);
      });
    });
  },

  atualizar: (id, dados, callback) => {
    const {
      nome,
      descricao = null,
      instrucoes = null,
      equipamento = null,
      dificuldade = 'intermediario',
      imagem_url = null,
      video_url = null,
      ativo = 1,
      academia_id,
      grupos_principais = [],
      grupos_secundarios = [],
    } = dados;

    const sql = `
      UPDATE exercicios
      SET nome = ?, descricao = ?, instrucoes = ?, equipamento = ?, dificuldade = ?, imagem_url = ?, video_url = ?, ativo = ?
      WHERE id = ? AND academia_id = ?
    `;

    const params = [
      nome.trim(),
      descricao ? descricao.trim() : null,
      instrucoes ? instrucoes.trim() : null,
      equipamento ? equipamento.trim() : null,
      dificuldade || 'intermediario',
      imagem_url ? imagem_url.trim() : null,
      video_url ? video_url.trim() : null,
      ativo === false || ativo === 0 ? 0 : 1,
      id,
      academia_id,
    ];

    db.run(sql, params, function (err) {
      if (err || !this.changes) return callback(err, null);
      Exercicio.sincronizarGrupos(id, grupos_principais, grupos_secundarios, (syncErr) => {
        if (syncErr) return callback(syncErr);
        Exercicio.buscarPorId(id, academia_id, callback);
      });
    });
  },

  deletar: (id, academiaId, callback) => {
    db.run(`DELETE FROM exercicios WHERE id = ? AND academia_id = ?`, [id, academiaId], function (err) {
      if (err) return callback(err);
      callback(null, {
        deleted: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = Exercicio;