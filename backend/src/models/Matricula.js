const db = require('../config/database');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');
const { situacaoEfetiva } = require('../services/vigenciaMatricula');

const comVigencia = ({ aluno_status, plano_valido, ...matricula }, hoje) => ({
  ...matricula,
  situacao_efetiva: situacaoEfetiva({ ...matricula, aluno_status, plano_valido }, hoje),
});

class Matricula {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS matriculas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        plano_id INTEGER NOT NULL,
        data_inicio TEXT NOT NULL,
        data_vencimento TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo', 'vencido', 'cancelado')),
        valor_pago REAL NOT NULL DEFAULT 0,
        academia_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos(id),
        FOREIGN KEY (plano_id) REFERENCES planos(id)
      )
    `;
    db.run(sql, callback);
  }

  static create({ aluno_id, plano_id, data_inicio, data_vencimento, status = 'ativo', valor_pago = 0, academia_id }, callback, executor = db) {
    const insert = 'INSERT INTO matriculas (aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, academia_id)';
    const parametros = [aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, academia_id];
    const sql = executor === db ? insert + ' VALUES (?, ?, ?, ?, ?, ?, ?)' : `${insert}
      SELECT a.id, p.id, CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS TEXT), CAST(? AS REAL), a.academia_id
      FROM alunos a JOIN planos p ON p.academia_id = a.academia_id
      WHERE a.id = ? AND p.id = ? AND a.academia_id = ?
      FOR SHARE OF a, p`;
    const valores = executor === db ? parametros : [data_inicio, data_vencimento, status, valor_pago, aluno_id, plano_id, academia_id];
    executor.run(sql, valores, function (err) {
      callback(err, this);
    });
  }

  static listar({ academia_id }, callback) {
    const sql = `
      SELECT m.*, a.nome as aluno_nome, p.nome as plano_nome, p.preco as plano_preco,
        a.status AS aluno_status, p.id AS plano_valido
      FROM matriculas m
      JOIN alunos a ON m.aluno_id = a.id AND m.academia_id = a.academia_id
      JOIN planos p ON m.plano_id = p.id AND m.academia_id = p.academia_id
      WHERE m.academia_id = ?
      ORDER BY m.criado_em DESC
    `;
    db.leitor().all(sql, [academia_id], (erro, registros) => {
      if (erro) return callback(erro);
      const hoje = getDataHojeFortaleza();
      callback(null, registros.map((matricula) => comVigencia(matricula, hoje)));
    });
  }

  static findById(id, academiaId, callback) {
    const sql = `
      SELECT m.id, m.data_inicio, m.data_vencimento, m.status, m.valor_pago, m.criado_em,
        m.academia_id, a.id AS aluno_id, p.id AS plano_id, a.status AS aluno_status, p.id AS plano_valido
      FROM matriculas m
      LEFT JOIN alunos a ON a.id = m.aluno_id AND a.academia_id = m.academia_id
      LEFT JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
      WHERE m.id = ? AND m.academia_id = ?
    `;
    db.get(sql, [id, academiaId], (erro, matricula) => {
      if (erro || !matricula) return callback(erro, matricula);
      callback(null, comVigencia(matricula, getDataHojeFortaleza()));
    });
  }

  static buscarOrigemRenovacao(id, academiaId, callback, executor = db) {
    const sql = `
      SELECT m.id, m.aluno_id, m.plano_id, m.status, m.data_inicio, m.data_vencimento,
        a.status AS aluno_status, p.id AS plano_valido, p.nome AS plano_nome,
        p.status AS plano_status, p.duracao_meses
      FROM matriculas m
      JOIN alunos a ON a.id = m.aluno_id AND a.academia_id = m.academia_id
      JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
      WHERE m.id = ? AND m.academia_id = ?
      ${executor === db ? '' : 'FOR NO KEY UPDATE OF a FOR SHARE OF m, p'}
    `;
    executor.get(sql, [id, academiaId], callback);
  }

  static listarVigenciasParaRenovacao(alunoId, academiaId, origemId, callback, executor = db) {
    const sql = `
      SELECT data_inicio, data_vencimento
      FROM matriculas
      WHERE aluno_id = ? AND academia_id = ? AND id <> ? AND status <> 'cancelado'
    `;
    executor.all(sql, [alunoId, academiaId, origemId], callback);
  }

  static atualizar(id, { aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago }, academiaId, callback) {
    const sql = `UPDATE matriculas SET aluno_id = ?, plano_id = ?, data_inicio = ?, data_vencimento = ?, status = ?, valor_pago = ? WHERE id = ? AND academia_id = ?`;
    db.run(sql, [aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago, id, academiaId], callback);
  }

  static excluir(id, academiaId, callback) {
    const sql = `DELETE FROM matriculas WHERE id = ? AND academia_id = ?`;
    db.run(sql, [id, academiaId], callback);
  }
}

module.exports = Matricula;
