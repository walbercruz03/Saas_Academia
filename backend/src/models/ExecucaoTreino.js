const db = require('../config/database');

const ExecucaoTreino = {
  criarTabela: (callback) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS execucoes_treino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        treino_id INTEGER,
        aluno_id INTEGER NOT NULL,
        modelo_id INTEGER,
        divisao_id INTEGER,
        modelo_nome VARCHAR(150),
        divisao_nome VARCHAR(150),
        snapshot_treino_json TEXT,
        data_execucao DATETIME DEFAULT CURRENT_TIMESTAMP,
        duracao_minutos INTEGER,
        percepcao_esforco INTEGER,
        observacao TEXT,
        cargas_json TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
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

    let snapshot_treino = null;
    if (row.snapshot_treino_json && typeof row.snapshot_treino_json === 'object') {
      snapshot_treino = row.snapshot_treino_json;
    } else if (typeof row.snapshot_treino_json === 'string' && row.snapshot_treino_json.trim()) {
      try {
        snapshot_treino = JSON.parse(row.snapshot_treino_json);
      } catch {
        snapshot_treino = null;
      }
    }

    return {
      ...row,
      cargas,
      snapshot_treino,
    };
  },

  listar: ({ alunoId = '', treinoId = '', modeloId = '', dataInicio = '', dataFim = '', academiaId } = {}, callback) => {
    const params = [academiaId];
    const conditions = [
      '(et.academia_id = a.academia_id OR et.academia_id IS NULL)',
      '(et.treino_id IS NULL OR t.id IS NOT NULL)',
      '(et.modelo_id IS NULL OR m.id IS NOT NULL)',
      '(et.divisao_id IS NULL OR d.id IS NOT NULL)',
    ];

    let sql = `
      SELECT
        et.*,
        a.nome AS aluno_nome,
        t.divisao AS treino_divisao,
        COALESCE(et.modelo_nome, m.nome, 'Treino Personalizado') AS modelo_nome,
        COALESCE(et.divisao_nome, d.nome, t.divisao, 'Sessão Livre') AS divisao_nome
      FROM execucoes_treino et
      JOIN alunos a ON a.id = et.aluno_id AND a.academia_id = ?
      LEFT JOIN treinos t ON t.id = et.treino_id AND t.aluno_id = a.id
        AND (t.academia_id = a.academia_id OR t.academia_id IS NULL)
      LEFT JOIN modelos_treino m ON m.id = et.modelo_id AND m.academia_id IN (0, a.academia_id)
      LEFT JOIN divisoes_treino d ON d.id = et.divisao_id AND d.modelo_id IN
        (SELECT id FROM modelos_treino WHERE academia_id IN (0, a.academia_id))
        AND (et.modelo_id IS NULL OR d.modelo_id = m.id)
    `;

    if (alunoId && String(alunoId).trim() !== '') {
      conditions.push(`et.aluno_id = ?`);
      params.push(Number(alunoId));
    }

    if (treinoId && String(treinoId).trim() !== '') {
      conditions.push(`et.treino_id = ?`);
      params.push(Number(treinoId));
    }

    if (modeloId && String(modeloId).trim() !== '') {
      conditions.push(`et.modelo_id = ?`);
      params.push(Number(modeloId));
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

  buscarPorId: (id, academiaId, callback) => {
    const sql = `
      SELECT
        et.*,
        a.nome AS aluno_nome,
        t.divisao AS treino_divisao,
        COALESCE(et.modelo_nome, m.nome, 'Treino Personalizado') AS modelo_nome,
        COALESCE(et.divisao_nome, d.nome, t.divisao, 'Sessão Livre') AS divisao_nome
      FROM execucoes_treino et
      JOIN alunos a ON a.id = et.aluno_id AND a.academia_id = ?
      LEFT JOIN treinos t ON t.id = et.treino_id AND t.aluno_id = a.id
        AND (t.academia_id = a.academia_id OR t.academia_id IS NULL)
      LEFT JOIN modelos_treino m ON m.id = et.modelo_id AND m.academia_id IN (0, a.academia_id)
      LEFT JOIN divisoes_treino d ON d.id = et.divisao_id AND d.modelo_id IN
        (SELECT id FROM modelos_treino WHERE academia_id IN (0, a.academia_id))
        AND (et.modelo_id IS NULL OR d.modelo_id = m.id)
      WHERE et.id = ?
        AND (et.academia_id = a.academia_id OR et.academia_id IS NULL)
        AND (et.treino_id IS NULL OR t.id IS NOT NULL)
        AND (et.modelo_id IS NULL OR m.id IS NOT NULL)
        AND (et.divisao_id IS NULL OR d.id IS NOT NULL)
    `;
    db.get(sql, [academiaId, id], (err, row) => {
      if (err) return callback(err);
      callback(null, row ? ExecucaoTreino.normalizarRow(row) : null);
    });
  },

  criar: (dados, callback) => {
    const {
      academiaId,
      treino_id = null,
      aluno_id,
      modelo_id = null,
      divisao_id = null,
      modelo_nome = null,
      divisao_nome = null,
      snapshot_treino = null,
      data_execucao = null,
      duracao_minutos = null,
      percepcao_esforco = null,
      observacao = null,
      cargas = [],
    } = dados;

    const cargasSerializadas = JSON.stringify(Array.isArray(cargas) ? cargas : []);
    
    // Constrói ou serializa o snapshot imutável do treino no momento da execução
    let snapshotFinal = snapshot_treino;
    if (!snapshotFinal && (modelo_nome || divisao_nome || (cargas && cargas.length > 0))) {
      snapshotFinal = {
        modelo_id: modelo_id ? Number(modelo_id) : null,
        modelo_nome: modelo_nome || 'Treino Personalizado',
        divisao_id: divisao_id ? Number(divisao_id) : null,
        divisao_nome: divisao_nome || 'Sessão',
        exercicios_executados: Array.isArray(cargas) ? cargas : [],
        gerado_em: new Date().toISOString(),
      };
    }
    const snapshotSerializado = snapshotFinal ? JSON.stringify(snapshotFinal) : null;

    const colunas = [
      'academia_id',
      'aluno_id',
      'treino_id',
      'modelo_id',
      'divisao_id',
      'modelo_nome',
      'divisao_nome',
      'snapshot_treino_json',
      'duracao_minutos',
      'percepcao_esforco',
      'observacao',
      'cargas_json',
    ];

    const placeholders = colunas.map(() => '?');

    const params = [
      academiaId,
      Number(aluno_id),
      treino_id !== '' && treino_id !== null ? Number(treino_id) : null,
      modelo_id !== '' && modelo_id !== null ? Number(modelo_id) : null,
      divisao_id !== '' && divisao_id !== null ? Number(divisao_id) : null,
      modelo_nome ? String(modelo_nome).trim() : null,
      divisao_nome ? String(divisao_nome).trim() : null,
      snapshotSerializado,
      duracao_minutos !== '' && duracao_minutos !== null ? Number(duracao_minutos) : null,
      percepcao_esforco !== '' && percepcao_esforco !== null ? Number(percepcao_esforco) : null,
      observacao ? String(observacao).trim() : null,
      cargasSerializadas,
    ];

    if (data_execucao && String(data_execucao).trim()) {
      colunas.push('data_execucao');
      placeholders.push('?');
      params.push(String(data_execucao).trim());
    }

    const sql = `
      INSERT INTO execucoes_treino (${colunas.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    db.run(sql, params, function (err) {
      if (err) return callback(err);
      const novoId = this && this.lastID ? this.lastID : null;
      if (!novoId) return callback(new Error('Não foi possível obter o ID da execução registrada.'));
      ExecucaoTreino.buscarPorId(novoId, academiaId, callback);
    });
  },

  deletar: (id, academiaId, callback) => {
    db.run(`DELETE FROM execucoes_treino WHERE id = ? AND (academia_id = ? OR academia_id IS NULL)
      AND aluno_id IN (SELECT id FROM alunos WHERE academia_id = ?)`, [id, academiaId, academiaId], function (err) {
      if (err) return callback(err);
      callback(null, {
        deleted: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = ExecucaoTreino;
