const db = require('../config/database');

const ExecucaoTreino = {
  criarTabela: (callback) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS execucoes_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treino_id INTEGER NOT NULL,
        aluno_id INTEGER NOT NULL,
        data_execucao DATETIME DEFAULT CURRENT_TIMESTAMP,
        duracao_minutos INTEGER,
        percepcao_esforco INTEGER,
        observacao TEXT,
        cargas_json TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (treino_id) REFERENCES treinos (id) ON DELETE CASCADE,
        FOREIGN KEY (aluno_id) REFERENCES alunos (id) ON DELETE CASCADE
      )
    `;
    db.run(sql, callback);
  },

  normalizarRow: (row) => {
    if (!row) return null;
    let cargas = [];
    if (Array.isArray(row.cargas_json)) {
      cargas = row.cargas_json;
    } else if (typeof row.cargas_json === 'string' && row.cargas_json.trim()) {
      try {
        const parsed = JSON.parse(row.cargas_json);
        cargas = Array.isArray(parsed) ? parsed : [];
      } catch {
        cargas = [];
      }
    }

    return {
      ...row,
      cargas,
    };
  },

  listar: ({ alunoId = '', treinoId = '', dataInicio = '', dataFim = '' } = {}, callback) => {
    const params = [];
    const conditions = [];

    let sql = `
      SELECT
        et.*,
        a.nome AS aluno_nome,
        t.divisao AS treino_divisao
      FROM execucoes_treino et
      LEFT JOIN alunos a ON a.id = et.aluno_id
      LEFT JOIN treinos t ON t.id = et.treino_id
    `;

    if (alunoId && String(alunoId).trim() !== '') {
      conditions.push(`et.aluno_id = ?`);
      params.push(Number(alunoId));
    }

    if (treinoId && String(treinoId).trim() !== '') {
      conditions.push(`et.treino_id = ?`);
      params.push(Number(treinoId));
    }

    if (dataInicio && String(dataInicio).trim() !== '') {
      conditions.push(`et.data_execucao >= ?`);
      params.push(`${String(dataInicio).trim()} 00:00:00`);
    }

    if (dataFim && String(dataFim).trim() !== '') {
      conditions.push(`et.data_execucao <= ?`);
      params.push(`${String(dataFim).trim()} 23:59:59`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY et.data_execucao DESC, et.id DESC`;

    db.all(sql, params, (err, rows) => {
      if (err) return callback(err);
      callback(null, (rows || []).map(ExecucaoTreino.normalizarRow));
    });
  },

  buscarPorId: (id, callback) => {
    const sql = `
      SELECT
        et.*,
        a.nome AS aluno_nome,
        t.divisao AS treino_divisao
      FROM execucoes_treino et
      LEFT JOIN alunos a ON a.id = et.aluno_id
      LEFT JOIN treinos t ON t.id = et.treino_id
      WHERE et.id = ?
    `;
    db.get(sql, [id], (err, row) => {
      if (err) return callback(err);
      callback(null, row ? ExecucaoTreino.normalizarRow(row) : null);
    });
  },

  criar: (dados, callback) => {
    const {
      treino_id,
      aluno_id,
      data_execucao = null,
      duracao_minutos = null,
      percepcao_esforco = null,
      observacao = null,
      cargas = [],
    } = dados;

    const cargasSerializadas = JSON.stringify(Array.isArray(cargas) ? cargas : []);

    const sql = data_execucao
      ? `
        INSERT INTO execucoes_treino
          (treino_id, aluno_id, data_execucao, duracao_minutos, percepcao_esforco, observacao, cargas_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      : `
        INSERT INTO execucoes_treino
          (treino_id, aluno_id, duracao_minutos, percepcao_esforco, observacao, cargas_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

    const params = data_execucao
      ? [
          Number(treino_id),
          Number(aluno_id),
          String(data_execucao).trim(),
          duracao_minutos !== '' && duracao_minutos !== null ? Number(duracao_minutos) : null,
          percepcao_esforco !== '' && percepcao_esforco !== null ? Number(percepcao_esforco) : null,
          observacao ? String(observacao).trim() : null,
          cargasSerializadas,
        ]
      : [
          Number(treino_id),
          Number(aluno_id),
          duracao_minutos !== '' && duracao_minutos !== null ? Number(duracao_minutos) : null,
          percepcao_esforco !== '' && percepcao_esforco !== null ? Number(percepcao_esforco) : null,
          observacao ? String(observacao).trim() : null,
          cargasSerializadas,
        ];

    db.run(sql, params, function (err) {
      if (err) return callback(err);
      const novoId = this && this.lastID ? this.lastID : null;
      if (!novoId) return callback(new Error('Não foi possível obter o ID da execução registrada.'));
      ExecucaoTreino.buscarPorId(novoId, callback);
    });
  },

  deletar: (id, callback) => {
    db.run(`DELETE FROM execucoes_treino WHERE id = ?`, [id], function (err) {
      if (err) return callback(err);
      callback(null, {
        deleted: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = ExecucaoTreino;