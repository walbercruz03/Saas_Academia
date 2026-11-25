const db = require('../config/database');
const ModeloTreino = require('./ModeloTreino');

const AlunoModeloTreino = {
  listarPorAluno: (alunoId, academiaId, callback) => {
    const sql = `
      SELECT
        amt.id AS vinculo_id,
        amt.aluno_id,
        amt.modelo_id,
        amt.data_inicio,
        amt.observacoes,
        amt.ativo,
        amt.criado_em,
        mt.id,
        mt.nome,
        mt.descricao,
        mt.divisao,
        mt.objetivo,
        mt.nivel,
        mt.modalidade_id,
        mt.nivel_id,
        mt.academia_id,
        m.nome AS modalidade_nome,
        nd.nome AS nivel_nome,
        u.nome AS professor_nome
      FROM aluno_modelos_treino amt
      INNER JOIN alunos a ON a.id = amt.aluno_id AND a.academia_id = ?
      INNER JOIN modelos_treino mt ON mt.id = amt.modelo_id AND mt.academia_id IN (0, a.academia_id)
      LEFT JOIN modalidades m ON m.id = mt.modalidade_id AND (m.academia_id IN (0, mt.academia_id) OR m.academia_id IS NULL)
      LEFT JOIN niveis_dificuldade nd ON nd.id = mt.nivel_id AND (nd.academia_id IN (0, mt.academia_id) OR nd.academia_id IS NULL)
      LEFT JOIN usuarios u ON u.id = mt.professor_id AND u.academia_id = mt.academia_id
      WHERE amt.aluno_id = ? AND amt.ativo = 1
        AND (amt.academia_id = a.academia_id OR amt.academia_id IS NULL)
      ORDER BY amt.id DESC
    `;

    db.all(sql, [academiaId, alunoId], (err, rows) => {
      if (err) return callback(err);
      if (!rows || rows.length === 0) return callback(null, []);

      // Anexa as divisões e exercícios atualizados em tempo real (compartilhados)
      ModeloTreino.anexarDivisoesEExercicios(rows, callback);
    });
  },

  validarModelos(modelosIds, academiaId, callback) {
    if (!Array.isArray(modelosIds)) {
      return callback(Object.assign(new Error('Informe uma lista de modelos.'), { status: 400 }));
    }
    const ids = [...new Set(modelosIds.map(Number))];
    if (ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
      return callback(Object.assign(new Error('Modelo de treino inválido.'), { status: 400 }));
    }
    if (!ids.length) return callback(null);
    db.all(`SELECT id FROM modelos_treino WHERE academia_id IN (0, ?)
      AND id IN (${ids.map(() => '?').join(',')})`, [academiaId, ...ids], (err, rows) => {
      if (err) return callback(err);
      if (rows.length !== ids.length) {
        return callback(Object.assign(new Error('Modelo de treino não encontrado.'), { status: 404 }));
      }
      callback(null);
    });
  },

  atribuir: (alunoId, { modelo_id, data_inicio = null, observacoes = null }, academiaId, callback) => {
    const mId = Number(modelo_id);
    if (!mId) {
      return callback(new Error('ID do modelo é obrigatório.'));
    }

    // Regra 3.2: Modelos inativos não poderão ser utilizados em novas atribuições
    db.get(`SELECT mt.id, mt.ativo FROM modelos_treino mt
      JOIN alunos a ON a.id = ? AND a.academia_id = ?
      WHERE mt.id = ? AND mt.academia_id IN (0, a.academia_id)`, [alunoId, academiaId, mId], (buscaErr, modelo) => {
      if (buscaErr) return callback(buscaErr);
      if (!modelo) {
        return callback(Object.assign(new Error('Vínculo não encontrado.'), { status: 404 }));
      }
      if (modelo.ativo === 0 || modelo.ativo === false) {
        const errInativo = new Error('Modelos inativos não podem ser atribuídos a alunos.');
        errInativo.status = 400;
        return callback(errInativo);
      }

      const sql = `
        INSERT INTO aluno_modelos_treino (aluno_id, modelo_id, data_inicio, observacoes, ativo, academia_id)
        VALUES (?, ?, COALESCE(?, CURRENT_DATE), ?, 1, ?)
      `;

      // Verifica se já existe registro (inclusive inativo) para reaproveitar ou inserir
      db.get(
        `SELECT id FROM aluno_modelos_treino WHERE aluno_id = ? AND modelo_id = ?
          AND (academia_id = ? OR academia_id IS NULL)`,
        [alunoId, mId, academiaId],
        (existErr, existente) => {
          if (existErr) return callback(existErr);

          if (existente) {
            db.run(
              `UPDATE aluno_modelos_treino SET ativo = 1, data_inicio = COALESCE(?, CURRENT_DATE), observacoes = ? WHERE id = ?`,
              [data_inicio, observacoes, existente.id],
              (upErr) => {
                if (upErr) return callback(upErr);
                AlunoModeloTreino.listarPorAluno(alunoId, academiaId, callback);
              }
            );
          } else {
            db.run(sql, [alunoId, mId, data_inicio, observacoes, academiaId], (insErr) => {
              if (insErr) return callback(insErr);
              AlunoModeloTreino.listarPorAluno(alunoId, academiaId, callback);
            });
          }
        }
      );
    });
  },

  atribuirMultiplos: (alunoId, modelosIds = [], observacoes = null, academiaId, callback) => {
    AlunoModeloTreino.validarModelos(modelosIds, academiaId, (err) => {
      if (err) return callback(err);
      const idsValidos = [...new Set((modelosIds || []).map(Number).filter(Boolean))];
      if (idsValidos.length === 0) {
        return callback(null, []);
      }

      let processados = 0;
      let falhou = false;

      idsValidos.forEach((mId) => {
        if (falhou) return;
        AlunoModeloTreino.atribuir(
          alunoId,
          { modelo_id: mId, observacoes },
          academiaId,
          (err) => {
            if (falhou) return;
            if (err) {
              falhou = true;
              return callback(err);
            }
            processados += 1;
            if (processados === idsValidos.length) {
              AlunoModeloTreino.listarPorAluno(alunoId, academiaId, callback);
            }
          }
        );
      });
    });
  },

  desassociar: (alunoId, modeloId, academiaId, callback) => {
    // Regra 3.2: Remover um modelo de um aluno deverá remover somente a associação individual
    const sql = `DELETE FROM aluno_modelos_treino WHERE aluno_id = ? AND modelo_id = ?
      AND (academia_id = ? OR academia_id IS NULL)
      AND aluno_id IN (SELECT id FROM alunos WHERE academia_id = ?)
      AND modelo_id IN (SELECT id FROM modelos_treino WHERE academia_id IN (0, ?))`;
    db.run(sql, [alunoId, modeloId, academiaId, academiaId, academiaId], function (err) {
      if (err) return callback(err);
      callback(null, {
        removido: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = AlunoModeloTreino;
