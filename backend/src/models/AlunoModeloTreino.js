const db = require('../config/database');
const ModeloTreino = require('./ModeloTreino');

const AlunoModeloTreino = {
  listarPorAluno: (alunoId, callback) => {
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
        m.nome AS modalidade_nome,
        nd.nome AS nivel_nome,
        u.nome AS professor_nome
      FROM aluno_modelos_treino amt
      INNER JOIN modelos_treino mt ON mt.id = amt.modelo_id
      LEFT JOIN modalidades m ON m.id = mt.modalidade_id
      LEFT JOIN niveis_dificuldade nd ON nd.id = mt.nivel_id
      LEFT JOIN usuarios u ON u.id = mt.professor_id
      WHERE amt.aluno_id = ? AND amt.ativo = 1
      ORDER BY amt.id DESC
    `;

    db.all(sql, [alunoId], (err, rows) => {
      if (err) return callback(err);
      if (!rows || rows.length === 0) return callback(null, []);

      // Anexa as divisões e exercícios atualizados em tempo real (compartilhados)
      ModeloTreino.anexarDivisoesEExercicios(rows, callback);
    });
  },

  atribuir: (alunoId, { modelo_id, data_inicio = null, observacoes = null }, callback) => {
    const mId = Number(modelo_id);
    if (!mId) {
      return callback(new Error('ID do modelo é obrigatório.'));
    }

    // Regra 3.2: Modelos inativos não poderão ser utilizados em novas atribuições
    db.get(`SELECT id, nome, ativo FROM modelos_treino WHERE id = ?`, [mId], (buscaErr, modelo) => {
      if (buscaErr) return callback(buscaErr);
      if (!modelo) {
        return callback(new Error('Modelo de treino não encontrado.'));
      }
      if (modelo.ativo === 0 || modelo.ativo === false) {
        const errInativo = new Error('Modelos inativos não podem ser atribuídos a alunos.');
        errInativo.status = 400;
        return callback(errInativo);
      }

      const sql = `
        INSERT INTO aluno_modelos_treino (aluno_id, modelo_id, data_inicio, observacoes, ativo)
        VALUES (?, ?, COALESCE(?, CURRENT_DATE), ?, 1)
      `;

      // Verifica se já existe registro (inclusive inativo) para reaproveitar ou inserir
      db.get(
        `SELECT id FROM aluno_modelos_treino WHERE aluno_id = ? AND modelo_id = ?`,
        [alunoId, mId],
        (existErr, existente) => {
          if (existErr) return callback(existErr);

          if (existente) {
            db.run(
              `UPDATE aluno_modelos_treino SET ativo = 1, data_inicio = COALESCE(?, CURRENT_DATE), observacoes = ? WHERE id = ?`,
              [data_inicio, observacoes, existente.id],
              (upErr) => {
                if (upErr) return callback(upErr);
                AlunoModeloTreino.listarPorAluno(alunoId, callback);
              }
            );
          } else {
            db.run(sql, [alunoId, mId, data_inicio, observacoes], (insErr) => {
              if (insErr) return callback(insErr);
              AlunoModeloTreino.listarPorAluno(alunoId, callback);
            });
          }
        }
      );
    });
  },

  atribuirMultiplos: (alunoId, modelosIds = [], observacoes = null, callback) => {
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
        (err) => {
          if (falhou) return;
          if (err) {
            falhou = true;
            return callback(err);
          }
          processados += 1;
          if (processados === idsValidos.length) {
            AlunoModeloTreino.listarPorAluno(alunoId, callback);
          }
        }
      );
    });
  },

  desassociar: (alunoId, modeloId, callback) => {
    // Regra 3.2: Remover um modelo de um aluno deverá remover somente a associação individual
    const sql = `DELETE FROM aluno_modelos_treino WHERE aluno_id = ? AND modelo_id = ?`;
    db.run(sql, [alunoId, modeloId], function (err) {
      if (err) return callback(err);
      callback(null, {
        removido: true,
        changes: this && typeof this.changes === 'number' ? this.changes : 0,
      });
    });
  },
};

module.exports = AlunoModeloTreino;
