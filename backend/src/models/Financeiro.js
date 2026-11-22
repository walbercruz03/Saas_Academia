const db = require('../config/database');

class Financeiro {
  static criarTabela(callback) {
    const sql = `
      CREATE TABLE IF NOT EXISTS movimentacoes_financeiras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL CHECK(tipo IN ('venda', 'receber', 'pagar')),
        categoria TEXT NOT NULL DEFAULT 'mensalidade',
        descricao TEXT NOT NULL,
        aluno_id INTEGER,
        matricula_id INTEGER,
        plano_id INTEGER,
        valor REAL NOT NULL DEFAULT 0,
        forma_pagamento TEXT CHECK(forma_pagamento IN ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'outro')),
        parcelas INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'pago', 'vencido', 'cancelado')),
        data_vencimento TEXT NOT NULL,
        data_pagamento DATETIME,
        observacoes TEXT,
        gateway TEXT,
        txid_externo TEXT,
        qr_code TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES alunos(id),
        FOREIGN KEY (matricula_id) REFERENCES matriculas(id),
        FOREIGN KEY (plano_id) REFERENCES planos(id)
      )
    `;
    db.run(sql, callback);
  }

  static criar(dados, callback) {
    const {
      tipo,
      categoria = 'mensalidade',
      descricao,
      aluno_id = null,
      matricula_id = null,
      plano_id = null,
      valor,
      forma_pagamento = 'pix',
      parcelas = 1,
      status = 'pendente',
      data_vencimento,
      data_pagamento = null,
      observacoes = null,
      gateway = null,
      txid_externo = null,
      qr_code = null,
    } = dados;

    const sql = `
      INSERT INTO movimentacoes_financeiras (
        tipo, categoria, descricao, aluno_id, matricula_id, plano_id,
        valor, forma_pagamento, parcelas, status, data_vencimento,
        data_pagamento, observacoes, gateway, txid_externo, qr_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        tipo,
        categoria,
        descricao,
        aluno_id,
        matricula_id,
        plano_id,
        valor,
        forma_pagamento,
        parcelas,
        status,
        data_vencimento,
        data_pagamento,
        observacoes,
        gateway,
        txid_externo,
        qr_code,
      ],
      function (err) {
        callback(err, { id: this?.lastID });
      }
    );
  }

  static listar({ tipo, status } = {}, callback) {
    const condicoes = [];
    const params = [];

    if (tipo) {
      condicoes.push('mf.tipo = ?');
      params.push(tipo);
    }
    if (status) {
      condicoes.push('mf.status = ?');
      params.push(status);
    }

    const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

    const sql = `
      SELECT
        mf.*,
        a.nome AS aluno_nome,
        p.nome AS plano_nome
      FROM movimentacoes_financeiras mf
      LEFT JOIN alunos a ON mf.aluno_id = a.id
      LEFT JOIN planos p ON mf.plano_id = p.id
      ${where}
      ORDER BY mf.data_vencimento ASC, mf.id DESC
    `;

    db.all(sql, params, callback);
  }

  static baixarPagamento(id, { forma_pagamento, parcelas = 1, data_pagamento, observacoes }, callback) {
    const sql = `
      UPDATE movimentacoes_financeiras
      SET status = 'pago',
          forma_pagamento = COALESCE(?, forma_pagamento),
          parcelas = COALESCE(?, parcelas),
          data_pagamento = COALESCE(?, CURRENT_TIMESTAMP),
          observacoes = COALESCE(?, observacoes)
      WHERE id = ?
    `;
    db.run(sql, [forma_pagamento, parcelas, data_pagamento, observacoes, id], function (err) {
      callback(err, { changes: this?.changes });
    });
  }

  static excluir(id, callback) {
    db.run(`DELETE FROM movimentacoes_financeiras WHERE id = ?`, [id], function (err) {
      callback(err, { changes: this?.changes });
    });
  }
}

module.exports = Financeiro;