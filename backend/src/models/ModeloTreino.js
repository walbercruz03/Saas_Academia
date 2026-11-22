const db = require('../config/database');

const ModeloTreino = {
  criarTabela: (callback) => {
    const queryModelos = `
      CREATE TABLE IF NOT EXISTS modelos_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        divisao TEXT NOT NULL DEFAULT 'Treino A',
        nivel TEXT NOT NULL DEFAULT 'intermediario',
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    db.run(queryModelos, (err) => {
      if (err) return callback(err);

      const queryItens = `
        CREATE TABLE IF NOT EXISTS modelo_treino_exercicios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          modelo_id INTEGER NOT NULL,
          exercicio_id INTEGER NOT NULL,
          ordem INTEGER NOT NULL DEFAULT 1,
          series TEXT NOT NULL DEFAULT '3',
          repeticoes TEXT NOT NULL DEFAULT '12',
          carga TEXT,
          descanso TEXT,
          observacao TEXT,
          FOREIGN KEY (modelo_id) REFERENCES modelos_treino (id) ON DELETE CASCADE,
          FOREIGN KEY (exercicio_id) REFERENCES exercicios (id) ON DELETE CASCADE
        )
      `;
      db.run(queryItens, callback);
    });
  },

  anexarExercicios: (modelos, callback) => {
    if (!Array.isArray(modelos) || modelos.length === 0) {
      return callback(null, []);
    }

    const ids = modelos.map((m) => m.id);
    const placeholders = ids.map(() => '?').join(', ');

    const sql = `
      SELECT
        mte.id,
        mte.modelo_id,
        mte.exercicio_id,
        mte.ordem,
        mte.series,
        mte.repeticoes,
        mte.carga,
        mte.descanso,
        mte.observacao,
        e.nome AS exercicio_nome,
        e.equipamento AS exercicio_equipamento,
        e.dificuldade AS exercicio_dificuldade
      FROM modelo_treino_exercicios mte
      INNER JOIN exercicios e ON e.id = mte.exercicio_id
      WHERE mte.modelo_id IN (${placeholders})
      ORDER BY mte.ordem ASC, mte.id ASC
    `;

    db.all(sql, ids, (err, itens) => {
      if (err) return callback(err);

      const mapa = new Map();
      modelos.forEach((m) => {
        mapa.set(m.id, {
          ...m,
          exercicios: [],
        });
      });

      (itens || []).forEach((item) => {
        const modelo = mapa.get(item.modelo_id);
        if (!modelo) return;
        modelo.exercicios.push({
          id: item.id,
          exercicio_id: item.exercicio_id,
          nome: item.exercicio_nome,
          equipamento: item.exercicio_equipamento,
          dificuldade: item.exercicio_dificuldade,
          ordem: Number(item.ordem || 1),
          series: item.series || '',
          repeticoes: item.repeticoes || '',
          carga: item.carga || '',
          descanso: item.descanso || '',
          observacao: item.observacao || '',
        });
      });

      callback(null, Array.from(mapa.values()));
    });
  },

  salvarItens: (modeloId, exercicios = [], callback) => {
    db.run(`DELETE FROM modelo_treino_exercicios WHERE modelo_id = ?`, [modeloId], (err) => {
      if (err) return callback(err);

      const validos = (Array.isArray(exercicios) ? exercicios : [])
        .map((item, idx) => ({
          exercicio_id: Number(item.exercicio_id),
          ordem: Number(item.ordem || idx + 1),
          series: item.series !== undefined && item.series !== null ? String(item.series).trim() : '3',
          repeticoes:
            item.repeticoes !== undefined && item.repeticoes !== null
              ? String(item.repeticoes).trim()
              : '12',
          carga: item.carga ? String(item.carga).trim() : null,
          descanso: item.descanso ? String(item.descanso).trim() : null,
          observacao: item.observacao ? String(item.observacao).trim() : null,
        }))
        .filter((item) => Boolean(item.exercicio_id));

      if (validos.length === 0) return callback(null);

      let concluidos = 0;
      let falhou = false;

      validos.forEach((item) => {
        if (falhou) return;
        db.run(
          `
            INSERT INTO modelo_treino_exercicios
              (modelo_id, exercicio_id, ordem, series, repeticoes, carga, descanso, observacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            modeloId,
            item.exercicio_id,
            item.ordem,
            item.series,
            item.repeticoes,
            item.carga,
            item.descanso,
            item.observacao,
          ],
          (insertErr) => {
            if (falhou) return;
            if (insertErr) {
              falhou = true;
              return callback(insertErr);
            }
            concluidos += 1;
            if (concluidos === validos.length) {
              callback(null);
            }
          }
        );
      });
    });
  },

  listar: ({ busca = '', nivel = '', apenasAtivos = false } = {}, callback) => {
    const params = [];
    const conditions = [];
    let sql = `SELECT * FROM modelos_treino`;

    if (busca && busca.trim() !== '') {
      const termo = `%${busca.trim()}%`;
      conditions.push(
        `(LOWER(nome) LIKE LOWER(?) OR LOWER(COALESCE(descricao, '')) LIKE LOWER(?) OR LOWER(COALESCE(divisao, '')) LIKE LOWER(?))`
      );
      params.push(termo, termo, termo);
    }

    if (nivel && nivel.trim() !== '') {
      conditions.push(`LOWER(nivel) = LOWER(?)`);
      params.push(nivel.trim());
    }

    if (apenasAtivos) {
      conditions.push(`ativo = 1`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY nome ASC, id DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return callback(err);
      ModeloTreino.anexarExercicios(rows || [], callback);
    });
  },

  buscarPorId: (id, callback) => {
    db.get(`SELECT * FROM modelos_treino WHERE id = ?`, [id], (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, null);
      ModeloTreino.anexarExercicios([row], (itemErr, lista) => {
        if (itemErr) return callback(itemErr);
        callback(null, lista[0] || null);
      });
    });
  },

  criar: (dados, callback) => {
    const {
      nome,
      descricao = null,
      divisao = 'Treino A',
      nivel = 'intermediario',
      ativo = 1,
      exercicios = [],
    } = dados;

    const sql = `
      INSERT INTO modelos_treino (nome, descricao, divisao, nivel, ativo)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      nome.trim(),
      descricao ? descricao.trim() : null,
      divisao && divisao.trim() ? divisao.trim() : 'Treino A',
      nivel || 'intermediario',
      ativo === false || ativo === 0 ? 0 : 1,
    ];

    db.run(sql, params, function (err) {
      if (err) return callback(err);
      const novoId = this && this.lastID ? this.lastID : null;
      if (!novoId) return callback(new Error('Não foi possível obter o ID do modelo criado.'));

      ModeloTreino.salvarItens(novoId, exercicios, (itemErr) => {
        if (itemErr) return callback(itemErr);
        ModeloTreino.buscarPorId(novoId, callback);
      });
    });
  },

  atualizar: (id, dados, callback) => {
    const {
      nome,
      descricao = null,
      divisao = 'Treino A',
      nivel = 'intermediario',
      ativo = 1,
      exercicios = [],
    } = dados;

    const sql = `
      UPDATE modelos_treino
      SET nome = ?, descricao = ?, divisao = ?, nivel = ?, ativo = ?
      WHERE id = ?
    `;

    const params = [
      nome.trim(),
      descricao ? descricao.trim() : null,
      divisao && divisao.trim() ? divisao.trim() : 'Treino A',
      nivel || 'intermediario',
      ativo === false || ativo === 0 ? 0 : 1,
      id,
    ];

    db.run(sql, params, (err) => {
      if (err) return callback(err);
      ModeloTreino.salvarItens(id, exercicios, (itemErr) => {
        if (itemErr) return callback(itemErr);
        ModeloTreino.buscarPorId(id, callback);
      });
    });
  },

  duplicar: (id, novoNome = null, callback) => {
    ModeloTreino.buscarPorId(id, (err, original) => {
      if (err) return callback(err);
      if (!original) return callback(null, null);

      const nomeCopia =
        novoNome && String(novoNome).trim()
          ? String(novoNome).trim()
          : `${original.nome} (Cópia)`;

      ModeloTreino.criar(
        {
          nome: nomeCopia,
          descricao: original.descricao,
          divisao: original.divisao,
          nivel: original.nivel,
          ativo: original.ativo,
          exercicios: original.exercicios || [],
        },
        callback
      );
    });
  },

  deletar: (id, callback) => {
    db.run(`DELETE FROM modelos_treino WHERE id = ?`, [id], function (err) {
      if (err) return callback(err);
      callback(null, {
        deleted: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = ModeloTreino;