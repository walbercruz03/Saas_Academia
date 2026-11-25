const db = require('../config/database');

const { TIMEZONE, formatarYMD, getDataHojeFortaleza, validarDataYMD } = require('../utils/datasFortaleza');
const { dataContratual, situacaoEfetiva } = require('./vigenciaMatricula');

const TIPOS_RELATORIO = [
  'geral',
  'financeiro',
  'alunos',
  'matriculas',
  'frequencia',
  'planos',
];

const PERIODOS_SUPORTADOS = [
  'hoje',
  'esta_semana',
  'este_mes',
  'mes_anterior',
  'ultimos_3_meses',
  'ultimos_6_meses',
  'este_ano',
  'personalizado',
];

const adicionarDiasYMD = (ymd, dias) => {
  const [ano, mes, dia] = ymd.split('-').map(Number);
  return formatarYMD(ano, mes, dia + dias);
};

const adicionarMesesYMD = (ymd, meses) => {
  const [ano, mes, dia] = ymd.split('-').map(Number);
  const ultimoDiaDestino = new Date(
    Date.UTC(ano, mes + meses, 0)
  ).getUTCDate();

  return formatarYMD(
    ano,
    mes + meses,
    Math.min(dia, ultimoDiaDestino)
  );
};

const fortalezaLocalParaUTC = (
  dataStr,
  horaStr = '00:00:00'
) => {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const [hh, mm, ss] = horaStr.split(':').map(Number);

  const dt = new Date(
    Date.UTC(ano, mes - 1, dia, hh + 3, mm, ss)
  );

  return dt.toISOString()
    .slice(0, 19)
    .replace('T', ' ');
};

const erroValidacao = (mensagem, statusCode = 400) => {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
};

const resolverIntervaloPeriodo = (
  periodo = 'hoje',
  dataInicioCustom,
  dataFimCustom,
  hoje
) => {
  const [ano, mes, dia] = hoje.split('-').map(Number);

  let inicio = hoje;
  let fim = hoje;
  let descricaoPeriodo = 'Hoje';

  switch (periodo) {
    case 'hoje':
      break;

    case 'esta_semana': {
      const diaSemana = new Date(
        Date.UTC(ano, mes - 1, dia)
      ).getUTCDay();

      const diferenca = diaSemana === 0
        ? -6
        : 1 - diaSemana;

      inicio = adicionarDiasYMD(hoje, diferenca);
      descricaoPeriodo = 'Esta semana';
      break;
    }

    case 'este_mes':
      inicio = formatarYMD(ano, mes, 1);
      descricaoPeriodo = 'Este mês';
      break;

    case 'mes_anterior':
      inicio = formatarYMD(ano, mes - 1, 1);
      fim = formatarYMD(ano, mes, 0);
      descricaoPeriodo = 'Mês anterior';
      break;

    case 'ultimos_3_meses':
      inicio = adicionarMesesYMD(hoje, -3);
      descricaoPeriodo = 'Últimos 3 meses';
      break;

    case 'ultimos_6_meses':
      inicio = adicionarMesesYMD(hoje, -6);
      descricaoPeriodo = 'Últimos 6 meses';
      break;

    case 'este_ano':
      inicio = formatarYMD(ano, 1, 1);
      descricaoPeriodo = 'Este ano';
      break;

    case 'personalizado':
      if (
        !validarDataYMD(dataInicioCustom) ||
        !validarDataYMD(dataFimCustom)
      ) {
        throw erroValidacao(
          'Informe datas válidas no formato AAAA-MM-DD.'
        );
      }

      inicio = dataInicioCustom;
      fim = dataFimCustom;

      if (inicio > fim) {
        throw erroValidacao(
          'A data inicial não pode ser maior que a final.'
        );
      }

      descricaoPeriodo = 'Período personalizado';
      break;

    default:
      throw erroValidacao('Período inválido.');
  }

  const fimExclusivoYMD = adicionarDiasYMD(fim, 1);

  return {
    descricaoPeriodo,
    dataInicio: inicio,
    dataFim: fim,
    fimExclusivoYMD,
    inicioUTC: fortalezaLocalParaUTC(inicio),
    fimUTCExclusivo: fortalezaLocalParaUTC(
      fimExclusivoYMD
    ),
  };
};

const runGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.leitor().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

const runAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.leitor().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

const numero = (valor) => Number(valor) || 0;

const obterDadosRelatorio = async ({
  tipo = 'geral',
  periodo = 'hoje',
  dataInicio,
  dataFim,
  academiaId,
} = {}) => {
  const academia = Number(academiaId);

  if (
    !Number.isSafeInteger(academia) ||
    academia <= 0
  ) {
    throw erroValidacao(
      'Academia não identificada. Faça login novamente.',
      403
    );
  }

  const tipoNormalizado = String(tipo).toLowerCase();
  const periodoNormalizado = String(periodo).toLowerCase();

  if (!TIPOS_RELATORIO.includes(tipoNormalizado)) {
    throw erroValidacao('Tipo de relatório inválido.');
  }

  if (!PERIODOS_SUPORTADOS.includes(periodoNormalizado)) {
    throw erroValidacao('Período inválido.');
  }

  const hojeFortaleza = getDataHojeFortaleza();
  const intervalo = resolverIntervaloPeriodo(
    periodoNormalizado,
    dataInicio,
    dataFim,
    hojeFortaleza
  );

  const {
    descricaoPeriodo,
    dataInicio: dtIni,
    dataFim: dtFim,
    fimExclusivoYMD,
    inicioUTC,
    fimUTCExclusivo,
  } = intervalo;

  // SQLite grava os horários padrão em UTC e aceita datas de pagamento ISO.
  // No PostgreSQL, CURRENT_TIMESTAMP é gravado no fuso da sessão em colunas sem fuso.
  const timestampComparavel = (coluna) => db.isSqlite ? `julianday(${coluna})` : coluna;
  const limiteUTC = db.isSqlite ? 'julianday(?)' : '(?)::timestamp';
  const limiteLocal = db.isSqlite
    ? limiteUTC
    : `((?)::timestamp AT TIME ZONE 'UTC' AT TIME ZONE current_setting('TimeZone'))`;
  const exibirTimestamp = (coluna) => db.isSqlite
    ? coluna
    : `(${coluna} AT TIME ZONE current_setting('TimeZone'))`;

  // ==========================================
  // 1. ALUNOS
  // ==========================================

  const resumoAlunosRow = await runGet(`
    SELECT
      COUNT(*) AS "totalBase",

      COALESCE(SUM(
        CASE WHEN status = 'ativo'
        THEN 1 ELSE 0 END
      ), 0) AS ativos,

      COALESCE(SUM(
        CASE WHEN status <> 'ativo'
        THEN 1 ELSE 0 END
      ), 0) AS inativos

    FROM alunos
    WHERE academia_id = ?
  `, [academia]);

  const alunosPeriodoLista = await runAll(`
    SELECT
      id,
      nome,
      cpf,
      telefone,
      email,
      status,
      ${exibirTimestamp('criado_em')} AS criado_em

    FROM alunos

    WHERE academia_id = ?
      AND ${timestampComparavel('criado_em')} >= ${limiteLocal}
      AND ${timestampComparavel('criado_em')} < ${limiteLocal}

    ORDER BY criado_em DESC
  `, [
    academia,
    inicioUTC,
    fimUTCExclusivo,
  ]);

  // ==========================================
  // 2. MATRÍCULAS
  // ==========================================

  const resumoMatriculasRow = await runGet(`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN substr(data_vencimento, 1, 10) >= ?
           AND substr(data_vencimento, 1, 10) < ?
          THEN 1 ELSE 0
        END
      ), 0) AS "vencidasNoPeriodo",

      COALESCE(SUM(
        CASE
          WHEN substr(data_inicio, 1, 10) >= ?
           AND substr(data_inicio, 1, 10) < ?
          THEN COALESCE(valor_pago, 0)
          ELSE 0
        END
      ), 0) AS "valorContratadoPeriodo"

    FROM matriculas
    WHERE academia_id = ?
  `, [
    dtIni,
    fimExclusivoYMD,
    dtIni,
    fimExclusivoYMD,
    academia,
  ]);

  const candidatas = await runAll(`
    SELECT m.status, m.data_inicio, m.data_vencimento, a.status AS aluno_status, p.id AS plano_valido
    FROM matriculas m
    JOIN alunos a ON a.id = m.aluno_id AND a.academia_id = m.academia_id
    JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
    WHERE m.academia_id = ? AND m.status = 'ativo'
      AND substr(m.data_inicio, 1, 10) <= ?
      AND substr(m.data_vencimento, 1, 10) >= ?
  `, [academia, hojeFortaleza, hojeFortaleza]);
  const ativas = candidatas.filter((matricula) => situacaoEfetiva(matricula, hojeFortaleza) === 'vigente').length;

  const matriculasPeriodoLista = await runAll(`
    SELECT
      m.id,
      m.aluno_id,
      m.plano_id,
      m.data_inicio,
      m.data_vencimento,
      m.status,
      m.valor_pago,
      m.criado_em,
      a.nome AS aluno_nome,
      a.status AS aluno_status,
      p.id AS plano_valido,
      p.nome AS plano_nome,
      p.preco AS plano_preco

    FROM matriculas m

    LEFT JOIN alunos a
      ON a.id = m.aluno_id
     AND a.academia_id = m.academia_id

    LEFT JOIN planos p
      ON p.id = m.plano_id
     AND p.academia_id = m.academia_id

    WHERE m.academia_id = ?
      AND substr(m.data_inicio, 1, 10) >= ?
      AND substr(m.data_inicio, 1, 10) < ?

    ORDER BY m.criado_em DESC
  `, [
    academia,
    dtIni,
    fimExclusivoYMD,
  ]);

  // ==========================================
  // 3. CHECK-INS
  // ==========================================

  const checkinsPeriodoLista = await runAll(`
    SELECT
      c.id,
      c.aluno_id,
      ${exibirTimestamp('c.data_checkin')} AS data_checkin,
      c.status,
      c.observacoes,
      a.nome AS aluno_nome,

      COUNT(*) OVER (PARTITION BY c.aluno_id) AS total_checkins_periodo

    FROM checkins c

    LEFT JOIN alunos a
      ON a.id = c.aluno_id
     AND a.academia_id = c.academia_id

    WHERE c.academia_id = ?
      AND ${timestampComparavel('c.data_checkin')} >= ${limiteLocal}
      AND ${timestampComparavel('c.data_checkin')} < ${limiteLocal}

    ORDER BY ${timestampComparavel('c.data_checkin')} DESC
  `, [
    academia,
    inicioUTC,
    fimUTCExclusivo,
  ]);

  // ==========================================
  // 4. PLANOS
  // ==========================================

  const planosPorContratacao = await runAll(`
    SELECT
      p.id,
      p.nome,
      p.preco,
      p.duracao_meses,
      p.status,

      COALESCE(SUM(
        CASE
          WHEN substr(m.data_inicio, 1, 10) >= ?
           AND substr(m.data_inicio, 1, 10) < ?
          THEN 1 ELSE 0
        END
      ), 0) AS "contratadosNoPeriodo",

      COALESCE(SUM(
        CASE
          WHEN substr(m.data_inicio, 1, 10) >= ?
           AND substr(m.data_inicio, 1, 10) < ?
          THEN COALESCE(m.valor_pago, 0)
          ELSE 0
        END
      ), 0) AS "valorContratadoPlano",

      COUNT(m.id) AS "totalMatriculas"

    FROM planos p

    LEFT JOIN matriculas m
      ON m.plano_id = p.id
     AND m.academia_id = p.academia_id

    WHERE p.academia_id = ?

    GROUP BY
      p.id,
      p.nome,
      p.preco,
      p.duracao_meses,
      p.status

    ORDER BY
      "contratadosNoPeriodo" DESC,
      "totalMatriculas" DESC,
      p.nome ASC
  `, [
    dtIni,
    fimExclusivoYMD,
    dtIni,
    fimExclusivoYMD,
    academia,
  ]);

  const totalContratadosPeriodo =
    planosPorContratacao.reduce(
      (total, plano) =>
        total + numero(plano.contratadosNoPeriodo),
      0
    );

  // ==========================================
  // 5. FINANCEIRO REAL
  // ==========================================
  //
  // Recebidos: data_pagamento no período.
  // Pendentes: criado_em no período.
  // Vencidos: pendências vencidas até o fim
  // do período consultado.
  //
  // O filtro academia_id é obrigatório.
  // ==========================================

  const financeiro = await runAll(`
    WITH vendas AS (
      SELECT forma_pagamento, valor,
        CASE WHEN status = 'pago'
          AND ${timestampComparavel('data_pagamento')} >= ${limiteUTC}
          AND ${timestampComparavel('data_pagamento')} < ${limiteUTC} THEN 1 ELSE 0 END AS recebida,
        CASE WHEN status = 'pendente'
          AND ${timestampComparavel('criado_em')} >= ${limiteLocal}
          AND ${timestampComparavel('criado_em')} < ${limiteLocal} THEN 1 ELSE 0 END AS pendente,
        CASE WHEN status IN ('pendente', 'vencido') AND substr(data_vencimento, 1, 10) < ?
          THEN 1 ELSE 0 END AS vencida
      FROM movimentacoes_financeiras WHERE academia_id = ? AND tipo = 'venda'
    )
    SELECT 'resumo' AS grupo, NULL AS forma_pagamento,
      COALESCE(SUM(CASE WHEN recebida = 1 THEN valor ELSE 0 END), 0) AS "totalRecebido",
      COALESCE(SUM(recebida), 0) AS confirmados,
      COALESCE(SUM(pendente), 0) AS pendentes,
      COALESCE(SUM(CASE WHEN pendente = 1 THEN valor ELSE 0 END), 0) AS "valorPendente",
      COALESCE(SUM(CASE WHEN vencida = 1 THEN valor ELSE 0 END), 0) AS "valorVencido"
    FROM vendas
    UNION ALL
    SELECT 'forma', forma_pagamento, COALESCE(SUM(valor), 0), NULL, NULL, NULL, NULL
    FROM vendas WHERE recebida = 1 GROUP BY forma_pagamento
  `, [inicioUTC, fimUTCExclusivo, inicioUTC, fimUTCExclusivo, fimExclusivoYMD, academia])
    .catch((erro) => {
      const schemaFinanceiroAusente = /(?:column|coluna).*academia_id|(?:table|relation|relação).*movimentacoes_financeiras/i;
      if (['42703', '42P01', 'SQLITE_ERROR'].includes(erro.code) && schemaFinanceiroAusente.test(erro.message)) return [];
      throw erro;
    });
  const finRow = financeiro.find((item) => item.grupo === 'resumo');
  const formasRows = financeiro.filter((item) => item.grupo === 'forma');

  const historicoRows = finRow ? await runAll(`
    SELECT
      id,
      descricao,
      valor,
      forma_pagamento,
      status,
      data_pagamento,
      criado_em,
      data_vencimento

    FROM movimentacoes_financeiras

    WHERE academia_id = ?
      AND tipo = 'venda'
      AND (
        (
          status = 'pago'
          AND ${timestampComparavel('data_pagamento')} >= ${limiteUTC}
          AND ${timestampComparavel('data_pagamento')} < ${limiteUTC}
        )
        OR
        (
          status <> 'pago'
          AND ${timestampComparavel('criado_em')} >= ${limiteLocal}
          AND ${timestampComparavel('criado_em')} < ${limiteLocal}
        )
      )

    ORDER BY
      COALESCE(data_pagamento, criado_em) DESC

    LIMIT 30
  `, [
    academia,
    inicioUTC,
    fimUTCExclusivo,
    inicioUTC,
    fimUTCExclusivo,
  ]) : [];

  const formasPagamento = {};

  formasRows.forEach((item) => {
    const forma = item.forma_pagamento || 'Não informado';

    formasPagamento[forma] = numero(item.totalRecebido);
  });

  const resumoFinanceiro = {
    disponivel: Boolean(finRow),

    valorContratadoPeriodo: numero(
      resumoMatriculasRow?.valorContratadoPeriodo
    ),

    totalRecebido: finRow ? numero(finRow.totalRecebido) : null,
    confirmados: finRow ? numero(finRow.confirmados) : null,
    pendentes: finRow ? numero(finRow.pendentes) : null,
    valorPendente: finRow ? numero(finRow.valorPendente) : null,
    valorVencido: finRow ? numero(finRow.valorVencido) : null,

    formas_pagamento: formasPagamento,
    historico: historicoRows,

    observacao: !finRow
      ? 'Recebimentos indisponíveis: o banco não permite identificar a academia dos lançamentos financeiros.'
      : 'Recebidos pela data de pagamento; ' +
        'pendentes pela data do lançamento; ' +
        'vencidos em aberto até o fim do período.',
  };

  // ==========================================
  // 6. RESPOSTA PARA O DASHBOARD
  // ==========================================

  return {
    tipo: tipoNormalizado,
    periodo: periodoNormalizado,
    descricaoPeriodo,
    timezone: TIMEZONE,

    dataInicio: dtIni,
    dataFim: dtFim,

    dataReferencia:
      dtIni === dtFim
        ? dtIni
        : `${dtIni} a ${dtFim}`,

    resumoAlunos: {
      totalPeriodo: numero(resumoAlunosRow?.totalBase),
      novosHoje: alunosPeriodoLista.length,
      novosNoPeriodo: alunosPeriodoLista.length,
      ativos: numero(resumoAlunosRow?.ativos),
      inativos: numero(resumoAlunosRow?.inativos),
      lista: alunosPeriodoLista,
    },

    resumoMatriculas: {
      totalHoje: matriculasPeriodoLista.length,
      totalNoPeriodo: matriculasPeriodoLista.length,
      vencidasHoje: numero(
        resumoMatriculasRow?.vencidasNoPeriodo
      ),
      vencidasNoPeriodo: numero(
        resumoMatriculasRow?.vencidasNoPeriodo
      ),
      canceladasHoje: null,
      ativas,
      valorContratadoPeriodo: numero(
        resumoMatriculasRow?.valorContratadoPeriodo
      ),
      lista: matriculasPeriodoLista.map(({ aluno_status, plano_valido, ...matricula }) => ({
        ...matricula,
        situacao_efetiva: situacaoEfetiva({ ...matricula, aluno_status, plano_valido }, hojeFortaleza),
      })),
    },

    resumoFrequencia: {
      totalCheckins: checkinsPeriodoLista.length,
      alunosDistinct: new Set(
        checkinsPeriodoLista.filter((checkin) => checkin.status === 'presente')
          .map((checkin) => checkin.aluno_id)
      ).size,
      lista: checkinsPeriodoLista,
    },

    resumoPlanos: {
      totalCadastrados: planosPorContratacao.length,
      ativos: planosPorContratacao.filter((plano) => plano.status === 'ativo').length,
      totalContratados: totalContratadosPeriodo,
      porPlano: planosPorContratacao,
    },

    resumoFinanceiro,
  };
};

async function obterResumoDashboard(academiaId) {
  const [contagens, matriculas] = await Promise.all([
    runGet(`
      SELECT (SELECT COUNT(*) FROM alunos WHERE academia_id = ?) AS alunos,
             (SELECT COUNT(*) FROM planos WHERE academia_id = ?) AS planos
    `, [academiaId, academiaId]),
    runAll(`
      SELECT m.status, m.data_inicio, m.data_vencimento, m.valor_pago,
        a.status AS aluno_status, p.id AS plano_valido
      FROM matriculas m
      JOIN alunos a ON a.id = m.aluno_id AND a.academia_id = m.academia_id
      JOIN planos p ON p.id = m.plano_id AND p.academia_id = m.academia_id
      WHERE m.academia_id = ?
    `, [academiaId]),
  ]);
  const situacoes = { vigente: 0, vencida: 0, futura: 0, cancelada: 0 };
  const porMes = new Map();
  const hoje = getDataHojeFortaleza();
  for (const item of matriculas) {
    const situacao = situacaoEfetiva(item, hoje);
    if (Object.hasOwn(situacoes, situacao)) situacoes[situacao] += 1;
    const inicio = dataContratual(item.data_inicio);
    if (!inicio) continue;
    const mes = inicio.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) || 0) + numero(item.valor_pago));
  }
  return { total_alunos: numero(contagens?.alunos), total_planos: numero(contagens?.planos),
    situacoes, valor_contratado: [...porMes].sort(([a], [b]) => a.localeCompare(b)) };
}

const obterDadosRelatorioHoje = (
  academiaId,
  callback
) => {
  obterDadosRelatorio({
    tipo: 'geral',
    periodo: 'hoje',
    academiaId,
  })
    .then((dados) => callback(null, dados))
    .catch((err) => callback(err, null));
};

module.exports = {
  obterDadosRelatorio,
  obterDadosRelatorioHoje,
  obterResumoDashboard,
  getDataHojeFortaleza,
  validarDataYMD,
  TIPOS_RELATORIO,
  PERIODOS_SUPORTADOS,
};
