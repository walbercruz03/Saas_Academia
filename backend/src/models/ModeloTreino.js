
const db = require('../config/database');

const erro = (mensagem, status = 400) => {
  const e = new Error(mensagem);
  e.status = status;
  return e;
};

const numeroId = (valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const n = Number(valor);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

const texto = (valor, padrao = null) =>
  valor === null || valor === undefined
    ? padrao
    : String(valor).trim();

const ativoSql = (valor) =>
  valor === false || valor === 0 ||
  valor === '0' || valor === 'false' ? 0 : 1;

const ModeloTreino = {
  criarTabela(callback) {
    if (typeof callback === 'function') callback(null);
  },

  anexarDivisoesEExercicios(modelos, callback) {
    if (!Array.isArray(modelos) || modelos.length === 0) {
      return callback(null, []);
    }

    const ids = modelos.map(m => m.id);
    const placeholders = ids.map(() => '?').join(',');

    db.all(`
      SELECT id, modelo_id, nome, descricao, ordem
      FROM divisoes_treino
      WHERE modelo_id IN (${placeholders})
      ORDER BY ordem, id
    `, ids, (err, divisoes) => {
      if (err) return callback(err);

      db.all(`
        SELECT
          mte.*,
          e.nome AS exercicio_nome,
          e.equipamento AS exercicio_equipamento,
          e.dificuldade AS exercicio_dificuldade,
          e.imagem_url AS exercicio_imagem_url,
          e.video_url AS exercicio_video_url
        FROM modelo_treino_exercicios mte
        INNER JOIN exercicios e
          ON e.id = mte.exercicio_id
        WHERE mte.modelo_id IN (${placeholders})
        ORDER BY mte.ordem, mte.id
      `, ids, (exErr, itens) => {
        if (exErr) return callback(exErr);

        const mapa = new Map();
        const mapaDivisoes = new Map();

        modelos.forEach(modelo => {
          mapa.set(Number(modelo.id), {
            ...modelo,
            divisoes: [],
            exercicios: []
          });
        });

        (divisoes || []).forEach(d => {
          const modelo = mapa.get(Number(d.modelo_id));
          if (!modelo) return;

          const divisao = {
            id: d.id,
            modelo_id: d.modelo_id,
            nome: d.nome,
            descricao: d.descricao || '',
            ordem: Number(d.ordem || 1),
            exercicios: []
          };

          modelo.divisoes.push(divisao);
          mapaDivisoes.set(Number(d.id), divisao);
        });

        mapa.forEach(modelo => {
          if (modelo.divisoes.length === 0) {
            modelo.divisoes.push({
              id: null,
              modelo_id: modelo.id,
              nome: modelo.divisao || 'Treino A',
              descricao: 'Divisão Geral',
              ordem: 1,
              exercicios: []
            });
          }
        });

        (itens || []).forEach(item => {
          const modelo = mapa.get(Number(item.modelo_id));
          if (!modelo) return;

          const exercicio = {
            id: item.id,
            modelo_id: item.modelo_id,
            divisao_id: item.divisao_id,
            exercicio_id: item.exercicio_id,
            nome: item.exercicio_nome,
            equipamento: item.exercicio_equipamento,
            dificuldade: item.exercicio_dificuldade,
            imagem_url: item.exercicio_imagem_url,
            video_url: item.exercicio_video_url,
            ordem: Number(item.ordem || 1),
            series: item.series || '3',
            repeticoes: item.repeticoes || '12',
            carga: item.carga || '',
            descanso: item.descanso || '60s',
            observacao: item.observacao || ''
          };

          modelo.exercicios.push(exercicio);

          const divisao = item.divisao_id
            ? mapaDivisoes.get(Number(item.divisao_id))
            : null;

          (divisao || modelo.divisoes[0])
            .exercicios.push(exercicio);
        });

        callback(null, Array.from(mapa.values()));
      });
    });
  },

  validarExercicios(academiaId, divisoes, exercicios, callback) {
    const itens = Array.isArray(divisoes) && divisoes.length
      ? divisoes.flatMap(d =>
          Array.isArray(d.exercicios) ? d.exercicios : [])
      : Array.isArray(exercicios) ? exercicios : [];

    const ids = [];

    for (const item of itens) {
      const id = Number(item.exercicio_id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        return callback(erro('ID de exercício inválido.'));
      }
      ids.push(id);
    }

    const unicos = [...new Set(ids)];
    if (!unicos.length) return callback(null);

    const placeholders = unicos.map(() => '?').join(',');

    // Modelos globais somente podem usar exercícios globais.
    const sql = Number(academiaId) === 0
      ? `SELECT id FROM exercicios
         WHERE id IN (${placeholders}) AND academia_id = 0`
      : `SELECT id FROM exercicios
         WHERE id IN (${placeholders})
         AND (academia_id = 0 OR academia_id = ?)`;

    const params = Number(academiaId) === 0
      ? unicos
      : [...unicos, Number(academiaId)];

    db.all(sql, params, (err, rows) => {
      if (err) return callback(err);

      if ((rows || []).length !== unicos.length) {
        return callback(erro(
          'Exercício inexistente ou pertencente a outra academia.',
          403
        ));
      }

      callback(null);
    });
  },

  salvarDivisoesEItens(modeloId, divisoes, callback) {
    const lista = Array.isArray(divisoes) && divisoes.length
      ? divisoes
      : [{
          nome: 'Treino A',
          descricao: 'Divisão Principal',
          ordem: 1,
          exercicios: []
        }];

    db.run(
      'DELETE FROM modelo_treino_exercicios WHERE modelo_id = ?',
      [modeloId],
      err => {
        if (err) return callback(err);

        db.run(
          'DELETE FROM divisoes_treino WHERE modelo_id = ?',
          [modeloId],
          delErr => {
            if (delErr) return callback(delErr);

            let indice = 0;

            const proximaDivisao = () => {
              if (indice >= lista.length) {
                return callback(null);
              }

              const d = lista[indice];
              const ordem = indice + 1;
              indice++;

              db.run(`
                INSERT INTO divisoes_treino
                  (modelo_id, nome, descricao, ordem)
                VALUES (?, ?, ?, ?)
              `, [
                modeloId,
                texto(d.nome, `Treino ${ordem}`),
                texto(d.descricao),
                Number(d.ordem || ordem)
              ], function (insertErr) {
                if (insertErr) return callback(insertErr);

                const divisaoId = this?.lastID;
                if (!divisaoId) {
                  return callback(erro(
                    'Não foi possível obter o ID da divisão.',
                    500
                  ));
                }

                const exercicios = Array.isArray(d.exercicios)
                  ? d.exercicios : [];

                let posicao = 0;

                const proximoExercicio = () => {
                  if (posicao >= exercicios.length) {
                    return proximaDivisao();
                  }

                  const item = exercicios[posicao];
                  posicao++;

                  db.run(`
                    INSERT INTO modelo_treino_exercicios
                    (
                      modelo_id, divisao_id, exercicio_id,
                      ordem, series, repeticoes, carga,
                      descanso, observacao
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `, [
                    modeloId,
                    divisaoId,
                    Number(item.exercicio_id),
                    Number(item.ordem || posicao),
                    texto(item.series, '3'),
                    texto(item.repeticoes, '12'),
                    texto(item.carga),
                    texto(item.descanso, '60s'),
                    texto(item.observacao)
                  ], exErr => {
                    if (exErr) return callback(exErr);
                    proximoExercicio();
                  });
                };

                proximoExercicio();
              });
            };

            proximaDivisao();
          }
        );
      }
    );
  },

  listar(filtros = {}, callback) {
    const {
      busca = '',
      academia_id,
      incluirGlobais = true,
      modalidadeId = '',
      nivelId = '',
      nivel = '',
      apenasAtivos = false
    } = filtros;

    const academia = numeroId(academia_id);

    if (academia === null) {
      return callback(erro('Escopo de academia obrigatório.'));
    }

    const params = [];
    const condicoes = [];

    let sql = `
      SELECT
        mt.*,
        m.nome AS modalidade_nome,
        nd.nome AS nivel_nome,
        u.nome AS professor_nome,
        COALESCE(
          COUNT(DISTINCT amt.aluno_id), 0
        ) AS total_alunos_vinculados
      FROM modelos_treino mt
      LEFT JOIN modalidades m ON m.id = mt.modalidade_id
      LEFT JOIN niveis_dificuldade nd ON nd.id = mt.nivel_id
      LEFT JOIN usuarios u ON u.id = mt.professor_id
      LEFT JOIN aluno_modelos_treino amt
        ON amt.modelo_id = mt.id AND amt.ativo = 1
    `;

    if (incluirGlobais) {
      condicoes.push(
        '(mt.academia_id = ? OR mt.academia_id = 0)'
      );
    } else {
      condicoes.push('mt.academia_id = ?');
    }
    params.push(academia);

    if (String(busca).trim()) {
      const termo = `%${String(busca).trim()}%`;
      condicoes.push(`(
        LOWER(mt.nome) LIKE LOWER(?)
        OR LOWER(COALESCE(mt.descricao, '')) LIKE LOWER(?)
        OR LOWER(COALESCE(mt.objetivo, '')) LIKE LOWER(?)
      )`);
      params.push(termo, termo, termo);
    }

    if (modalidadeId !== '') {
      condicoes.push('mt.modalidade_id = ?');
      params.push(Number(modalidadeId));
    }

    if (nivelId !== '') {
      condicoes.push('mt.nivel_id = ?');
      params.push(Number(nivelId));
    }

    if (String(nivel).trim()) {
      condicoes.push(`(
        LOWER(mt.nivel) = LOWER(?)
        OR LOWER(COALESCE(nd.slug, '')) = LOWER(?)
      )`);
      params.push(nivel, nivel);
    }

    if (apenasAtivos) {
      condicoes.push('mt.ativo = 1');
    }

    sql += ` WHERE ${condicoes.join(' AND ')}`;

    sql += `
      GROUP BY mt.id, mt.nome, m.nome, nd.nome, u.nome
      ORDER BY mt.nome ASC, mt.id DESC
    `;

    db.all(sql, params, (err, rows) => {
      if (err) return callback(err);
      ModeloTreino.anexarDivisoesEExercicios(
        rows || [], callback
      );
    });
  },

  buscarPorId(id, callback) {
    const sql = `
      SELECT
        mt.*,
        m.nome AS modalidade_nome,
        nd.nome AS nivel_nome,
        u.nome AS professor_nome,
        COALESCE(
          COUNT(DISTINCT amt.aluno_id), 0
        ) AS total_alunos_vinculados
      FROM modelos_treino mt
      LEFT JOIN modalidades m ON m.id = mt.modalidade_id
      LEFT JOIN niveis_dificuldade nd ON nd.id = mt.nivel_id
      LEFT JOIN usuarios u ON u.id = mt.professor_id
      LEFT JOIN aluno_modelos_treino amt
        ON amt.modelo_id = mt.id AND amt.ativo = 1
      WHERE mt.id = ?
      GROUP BY mt.id, mt.nome, m.nome, nd.nome, u.nome
    `;

    db.get(sql, [id], (err, row) => {
      if (err) return callback(err);
      if (!row) return callback(null, null);

      ModeloTreino.anexarDivisoesEExercicios(
        [row],
        (anexoErr, lista) => {
          if (anexoErr) return callback(anexoErr);
          callback(null, lista[0] || null);
        }
      );
    });
  },

  criar(dados, callback) {
    const academia = numeroId(dados.academia_id);

    if (academia === null) {
      return callback(erro('academia_id obrigatório.'));
    }

    if (!String(dados.nome || '').trim()) {
      return callback(erro('Nome obrigatório.'));
    }

    const divisoes = Array.isArray(dados.divisoes) &&
      dados.divisoes.length
      ? dados.divisoes
      : [{
          nome: dados.divisao || 'Treino A',
          descricao: 'Divisão Principal',
          ordem: 1,
          exercicios: dados.exercicios || []
        }];

    ModeloTreino.validarExercicios(
      academia, divisoes, [], validErr => {
        if (validErr) return callback(validErr);

        const sql = `
          INSERT INTO modelos_treino
          (
            nome, descricao, divisao, modalidade_id,
            nivel_id, nivel, objetivo, professor_id,
            academia_id, ativo
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
          String(dados.nome).trim(),
          texto(dados.descricao),
          texto(dados.divisao, 'Treino A'),
          dados.modalidade_id || null,
          dados.nivel_id || null,
          texto(dados.nivel, 'intermediario'),
          texto(dados.objetivo),
          dados.professor_id || null,
          academia,
          ativoSql(dados.ativo)
        ];

        db.run(sql, params, function (err) {
          if (err) return callback(err);

          const novoId = this?.lastID;

          if (!novoId) {
            return callback(erro(
              'Não foi possível obter o ID criado.', 500
            ));
          }

          ModeloTreino.salvarDivisoesEItens(
            novoId, divisoes, saveErr => {
              if (saveErr) return callback(saveErr);

              ModeloTreino.buscarPorId(novoId, callback);
            }
          );
        });
      }
    );
  },

  atualizar(id, dados, callback) {
    const academia = numeroId(dados.academia_id);

    if (academia === null) {
      return callback(erro('Escopo de academia obrigatório.'));
    }

    if (!String(dados.nome || '').trim()) {
      return callback(erro('Nome obrigatório.'));
    }

    const divisoes = Array.isArray(dados.divisoes) &&
      dados.divisoes.length
      ? dados.divisoes
      : [{
          nome: dados.divisao || 'Treino A',
          descricao: 'Divisão Principal',
          ordem: 1,
          exercicios: dados.exercicios || []
        }];

    ModeloTreino.validarExercicios(
      academia, divisoes, [], validErr => {
        if (validErr) return callback(validErr);

        const sql = `
          UPDATE modelos_treino
          SET
            nome = ?,
            descricao = ?,
            divisao = ?,
            modalidade_id = ?,
            nivel_id = ?,
            nivel = ?,
            objetivo = ?,
            professor_id = COALESCE(?, professor_id),
            ativo = ?
          WHERE id = ? AND academia_id = ?
        `;

        const params = [
          String(dados.nome).trim(),
          texto(dados.descricao),
          texto(dados.divisao, 'Treino A'),
          dados.modalidade_id || null,
          dados.nivel_id || null,
          texto(dados.nivel, 'intermediario'),
          texto(dados.objetivo),
          dados.professor_id || null,
          ativoSql(dados.ativo),
          id,
          academia
        ];

        db.run(sql, params, function (err) {
          if (err) return callback(err);

          if (this?.changes !== 1) {
            return callback(erro(
              'Modelo não encontrado nesta academia.', 404
            ));
          }

          ModeloTreino.salvarDivisoesEItens(
            id, divisoes, saveErr => {
              if (saveErr) return callback(saveErr);
              ModeloTreino.buscarPorId(id, callback);
            }
          );
        });
      }
    );
  },

  duplicar(id, novoNome, academiaDestinoId, callback) {
    if (typeof callback !== 'function') {
      throw new Error(
        'Duplicar exige ID, nome, academia de destino e callback.'
      );
    }

    const academia = numeroId(academiaDestinoId);

    if (academia === null || academia === 0) {
      return callback(erro('Academia de destino inválida.'));
    }

    ModeloTreino.buscarPorId(id, (err, original) => {
      if (err) return callback(err);
      if (!original) return callback(null, null);

      const origem = numeroId(original.academia_id);

      if (origem !== 0 && origem !== academia) {
        return callback(erro(
          'Modelo pertence a outra academia.', 403
        ));
      }

      ModeloTreino.criar({
        nome: novoNome || `${original.nome} (Cópia)`,
        descricao: original.descricao,
        divisao: original.divisao,
        modalidade_id: original.modalidade_id,
        nivel_id: original.nivel_id,
        nivel: original.nivel,
        objetivo: original.objetivo,
        professor_id: null,
        academia_id: academia,
        ativo: original.ativo,
        divisoes: original.divisoes || []
      }, callback);
    });
  },

  deletar(id, academiaId, callback) {
    const academia = numeroId(academiaId);

    if (academia === null || academia === 0) {
      return callback(erro('Academia inválida.', 403));
    }

    db.get(`
      SELECT COUNT(*) AS total
      FROM aluno_modelos_treino
      WHERE modelo_id = ? AND ativo = 1
    `, [id], (err, row) => {
      if (err) return callback(err);

      if (Number(row?.total || 0) > 0) {
        return callback(erro(
          'O modelo possui alunos vinculados. ' +
          'Remova os vínculos antes de excluir.'
        ));
      }

      db.run(`
        DELETE FROM modelos_treino
        WHERE id = ? AND academia_id = ?
      `, [id, academia], function (deleteErr) {
        if (deleteErr) return callback(deleteErr);

        if (this?.changes !== 1) {
          return callback(erro(
            'Modelo não encontrado nesta academia.', 404
          ));
        }

        callback(null, {
          deleted: true,
          changes: this.changes
        });
      });
    });
  }
};

module.exports = ModeloTreino;
