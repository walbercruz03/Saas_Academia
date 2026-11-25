const db = require('../config/database');
const GATEWAY_IDEMPOTENCIA = 'wcfit:idempotencia:v1';
const resultadoReenvio = (row, chave, resumo) => row.txid_externo === `${chave}:${resumo}`
  ? { id: row.id, reutilizado: true }
  : { conflito: true };

class Financeiro {
  static listarMensalidadesParaCheckin(alunoId, academiaId, callback, executor = db) {
    executor.all(`
      SELECT f.matricula_id, f.status, f.valor, f.data_vencimento, f.data_pagamento
      FROM movimentacoes_financeiras f
      JOIN matriculas m ON m.id = f.matricula_id AND m.academia_id = f.academia_id
      JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
      WHERE m.aluno_id = ? AND m.academia_id = ? AND m.status = 'ativo' AND p.preco > 0
        AND f.tipo = 'receber' AND f.categoria = 'mensalidade'
        AND (f.aluno_id IS NULL OR f.aluno_id = m.aluno_id)
        AND (f.plano_id IS NULL OR f.plano_id = m.plano_id)
    `, [alunoId, academiaId], callback);
  }

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

  static buscarReenvio(academiaId, { chave, resumo }) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT id, txid_externo FROM movimentacoes_financeiras
        WHERE academia_id = ? AND gateway = ? AND txid_externo LIKE ?`,
      [academiaId, GATEWAY_IDEMPOTENCIA, `${chave}:%`], (err, row) => {
        if (err) return reject(err);
        resolve(row ? resultadoReenvio(row, chave, resumo) : null);
      });
    });
  }

  static async criar(dados, { chave, resumo }) {
    const {
      tipo,
      academia_id,
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
      qr_code = null,
    } = dados;

    const valores = [
      tipo, categoria, descricao, aluno_id, matricula_id, plano_id,
      valor, forma_pagamento, parcelas, status, data_vencimento,
      data_pagamento, observacoes, GATEWAY_IDEMPOTENCIA, `${chave}:${resumo}`, qr_code, academia_id,
    ];

    const colunas = `movimentacoes_financeiras (
      tipo, categoria, descricao, aluno_id, matricula_id, plano_id,
      valor, forma_pagamento, parcelas, status, data_vencimento,
      data_pagamento, observacoes, gateway, txid_externo, qr_code, academia_id
    )`;
    const filtro = [academia_id, GATEWAY_IDEMPOTENCIA, `${chave}:%`];
    if (db.isSqlite) {
      // O teste de existência e a inserção fazem parte da mesma escrita do SQLite.
      const escopo = 'academia_id = ? AND gateway = ? AND txid_externo LIKE ?';
      return new Promise((resolve, reject) => {
        db.run(`INSERT INTO ${colunas}
          SELECT ${valores.map(() => '?').join(', ')}
          WHERE NOT EXISTS (SELECT 1 FROM movimentacoes_financeiras WHERE ${escopo})`,
        [...valores, ...filtro], function (err) {
          if (err) return reject(err);
          if (this.changes) return resolve({ id: this.lastID });
          db.get(`SELECT id, txid_externo FROM movimentacoes_financeiras WHERE ${escopo}`, filtro,
            (erro, row) => erro || !row
              ? reject(erro || new Error('Lançamento removido durante a consulta.'))
              : resolve(resultadoReenvio(row, chave, resumo)));
        });
      });
    }

    const client = await db.pool.connect();
    let descartar = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      // A trava vale para todas as conexões e é liberada ao encerrar a transação.
      await client.query('SELECT pg_advisory_xact_lock($1::integer, hashtext($2))',
        [academia_id, `${GATEWAY_IDEMPOTENCIA}:${chave}`]);
      const { rows: [existente] } = await client.query(`
        SELECT id, txid_externo FROM movimentacoes_financeiras
        WHERE academia_id = $1 AND gateway = $2 AND txid_externo LIKE $3`, filtro);
      if (existente) {
        await client.query('COMMIT');
        return resultadoReenvio(existente, chave, resumo);
      }
      const { rows: [criado] } = await client.query(
        `INSERT INTO ${colunas} VALUES (${valores.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING id`, valores);
      await client.query('COMMIT');
      return { id: criado.id };
    } catch (erro) {
      try {
        await client.query('ROLLBACK');
      } catch {
        descartar = true;
      }
      throw erro;
    } finally {
      client.release(descartar);
    }
  }

  static listar({ tipo, status, academiaId, pagina, inicio, fim } = {}, callback) {
    const condicoes = ['mf.academia_id = ?'];
    const params = [academiaId];

    if (tipo) {
      condicoes.push('mf.tipo = ?');
      params.push(tipo);
    }
    if (status) {
      condicoes.push('mf.status = ?');
      params.push(status);
    }
    if (pagina !== undefined && inicio && fim) {
      condicoes.push('substr(mf.data_vencimento, 1, 10) BETWEEN ? AND ?');
      params.push(inicio, fim);
    }

    const where = `WHERE ${condicoes.join(' AND ')}`;

    const pagamento = db.isSqlite ? 'mf.data_pagamento' : "(mf.data_pagamento AT TIME ZONE 'UTC')";
    const tamanho = 50;
    const paginado = pagina !== undefined;
    const ordenacao = 'mf.data_vencimento ASC, mf.id DESC';
    const cte = paginado ? `
      WITH filtradas AS (SELECT mf.* FROM movimentacoes_financeiras mf ${where}),
      totais AS (
        SELECT COUNT(*) AS qtd,
          COALESCE(SUM(CAST(valor AS DOUBLE PRECISION)), 0) AS total_geral,
          COALESCE(SUM(CASE WHEN status = 'pago' THEN CAST(valor AS DOUBLE PRECISION) END), 0) AS total_pago,
          COALESCE(SUM(CASE WHEN status = 'pendente' THEN CAST(valor AS DOUBLE PRECISION) END), 0) AS total_pendente
        FROM filtradas
      )
    ` : '';
    const origem = paginado
      ? `totais LEFT JOIN (SELECT * FROM filtradas mf ORDER BY ${ordenacao} LIMIT ? OFFSET ?) mf ON 1=1`
      : 'movimentacoes_financeiras mf';
    const sql = `${cte}
      SELECT
        ${paginado ? 'totais.*,' : ''}
        mf.id, mf.tipo, mf.categoria, mf.descricao, mf.valor, mf.forma_pagamento,
        mf.parcelas, mf.status, mf.data_vencimento, ${pagamento} AS data_pagamento, mf.observacoes,
        NULLIF(mf.gateway, '${GATEWAY_IDEMPOTENCIA}') AS gateway,
        CASE WHEN mf.gateway = '${GATEWAY_IDEMPOTENCIA}' THEN NULL ELSE mf.txid_externo END AS txid_externo,
        mf.qr_code, mf.criado_em, mf.academia_id,
        a.id AS aluno_id, m.id AS matricula_id, p.id AS plano_id,
        a.nome AS aluno_nome,
        p.nome AS plano_nome
      FROM ${origem}
      LEFT JOIN alunos a ON mf.aluno_id = a.id AND mf.academia_id = a.academia_id
      LEFT JOIN matriculas m ON mf.matricula_id = m.id AND mf.academia_id = m.academia_id
      LEFT JOIN planos p ON mf.plano_id = p.id AND mf.academia_id = p.academia_id
      ${paginado ? '' : where}
      ORDER BY ${ordenacao}
    `;

    if (!paginado) return db.all(sql, params, callback);
    db.leitor().all(sql, [...params, tamanho, (pagina - 1) * tamanho], (erro, rows) => {
      if (erro) return callback(erro);
      const { qtd, total_geral, total_pago, total_pendente } = rows[0];
      const registros = rows.filter((row) => row.id !== null)
        .map(({ qtd, total_geral, total_pago, total_pendente, ...row }) => row);
      return callback(null, { registros, pagina, temMais: Number(qtd) > pagina * tamanho, totais: {
        geral: Number(total_geral), pago: Number(total_pago), pendente: Number(total_pendente),
      } });
    });
  }

  static baixarPagamento(id, { forma_pagamento, parcelas = 1, data_pagamento, observacoes }, academiaId, callback) {
    const agoraUTC = db.isSqlite ? 'CURRENT_TIMESTAMP' : "CURRENT_TIMESTAMP AT TIME ZONE 'UTC'";
    const sql = `
      UPDATE movimentacoes_financeiras
      SET status = 'pago',
          forma_pagamento = COALESCE(?, forma_pagamento),
          parcelas = COALESCE(?, parcelas),
          data_pagamento = COALESCE(data_pagamento, ?, ${agoraUTC}),
          observacoes = COALESCE(?, observacoes)
      WHERE id = ? AND academia_id = ? AND status IN ('pendente', 'vencido')
      AND (aluno_id IS NULL OR EXISTS (
        SELECT 1 FROM alunos a WHERE a.id = movimentacoes_financeiras.aluno_id
          AND a.academia_id = movimentacoes_financeiras.academia_id
      ))
      AND (plano_id IS NULL OR EXISTS (
        SELECT 1 FROM planos p WHERE p.id = movimentacoes_financeiras.plano_id
          AND p.academia_id = movimentacoes_financeiras.academia_id
      ))
      AND (matricula_id IS NULL OR EXISTS (
        SELECT 1 FROM matriculas m
        JOIN alunos a ON a.id = m.aluno_id AND a.academia_id = m.academia_id
        JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
        WHERE m.id = movimentacoes_financeiras.matricula_id
          AND m.academia_id = movimentacoes_financeiras.academia_id
          AND (movimentacoes_financeiras.aluno_id IS NULL OR movimentacoes_financeiras.aluno_id = m.aluno_id)
          AND (movimentacoes_financeiras.plano_id IS NULL OR movimentacoes_financeiras.plano_id = m.plano_id)
      ))
    `;
    db.run(sql, [forma_pagamento, parcelas, data_pagamento, observacoes, id, academiaId], function (err) {
      if (err || this?.changes) return callback(err, { status: 'pago' });
      db.get('SELECT status FROM movimentacoes_financeiras WHERE id = ? AND academia_id = ?',
        [id, academiaId], (erro, row) => callback(erro, { status: row?.status, jaPago: row?.status === 'pago' }));
    });
  }

  static excluir(id, academiaId, callback) {
    db.run(`DELETE FROM movimentacoes_financeiras WHERE id = ? AND academia_id = ?`, [id, academiaId], function (err) {
      callback(err, { changes: this?.changes });
    });
  }
}

module.exports = Financeiro;
