const db = require('../config/database');

const TIMEZONE = 'America/Fortaleza';

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

const formatarYMD = (ano, mes, dia) => {
  const dt = new Date(Date.UTC(ano, mes - 1, dia));

  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, '0'),
    String(dt.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

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

const getDataHojeFortaleza = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obter = (tipo) =>
    partes.find((p) => p.type === tipo)?.value;

  return `${obter('year')}-${obter('month')}-${obter('day')}`;
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

const validarDataYMD = (valor) => {
  if (
    typeof valor !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return false;
  }

  const [ano, mes, dia] = valor.split('-').map(Number);

  return formatarYMD(ano, mes, dia) === valor;
};

const erroValidacao = (mensagem, statusCode = 400) => {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
};

const resolverIntervaloPeriodo = (
  periodo = 'hoje',
  dataInicioCustom,
  dataFimCustom
) => {
  const hoje = getDataHojeFortaleza();
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
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

const runAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
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

  const intervalo = resolverIntervaloPeriodo(
    periodoNormalizado,
    dataInicio,
    dataFim
  );

  const {
    descricaoPeriodo,
    dataInicio: dtIni,
    dataFim: dtFim,
    fimExclusivoYMD,
    inicioUTC,
    fimUTCExclusivo,
  } = intervalo;

  // ==========================================
  // 1. ALUNOS
  // ==========================================

  const resumoAlunosRow = await runGet(`
    SELECT
      COUNT(*) AS totalBase,

      COALESCE(SUM(
        CASE WHEN status = 'ativo'
        THEN 1 ELSE 0 END
      ), 0) AS ativos,

      COALESCE(SUM(
        CASE WHEN status <> 'ativo'
        THEN 1 ELSE 0 END
      ), 0) AS inativos,

      COALESCE(SUM(
        CASE
          WHEN criado_em >= (?)::timestamp
           AND criado_em < (?)::timestamp
          THEN 1 ELSE 0
        END
      ), 0) AS novosNoPeriodo

    FROM alunos
    WHERE academia_id = ?
  `, [
    inicioUTC,
    fimUTCExclusivo,
    academia,
  ]);

  const alunosPeriodoLista = await runAll(`
    SELECT
      id,
      nome,
      cpf,
      telefone,
      email,
      status,
      criado_em

    FROM alunos

    WHERE academia_id = ?
      AND criado_em >= (?)::timestamp
      AND criado_em < (?)::timestamp

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
          WHEN substr(data_inicio, 1, 10) >= ?
           AND substr(data_inicio, 1, 10) < ?
          THEN 1 ELSE 0
        END
      ), 0) AS totalNoPeriodo,

      COALESCE(SUM(
        CASE
          WHEN substr(data_vencimento, 1, 10) >= ?
           AND substr(data_vencimento, 1, 10) < ?
          THEN 1 ELSE 0
        END
      ), 0) AS vencidasNoPeriodo,

      COALESCE(SUM(
        CASE WHEN status = 'ativo'
        THEN 1 ELSE 0 END
      ), 0) AS ativas,

      COALESCE(SUM(
        CASE
          WHEN substr(data_inicio, 1, 10) >= ?
           AND substr(data_inicio, 1, 10) < ?
          THEN COALESCE(valor_pago, 0)
          ELSE 0
        END
      ), 0) AS valorContratadoPeriodo

    FROM matriculas
    WHERE academia_id = ?
  `, [
    dtIni,
    fimExclusivoYMD,
    dtIni,
    fimExclusivoYMD,
    dtIni,
    fimExclusivoYMD,
    academia,
  ]);

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
      p.nome AS plano_nome,
      p.preco AS plano_preco

    FROM matriculas m

    JOIN alunos a
      ON a.id = m.aluno_id
     AND a.academia_id = m.academia_id

    JOIN planos p
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

  const resumoFrequenciaRow = await runGet(`
    SELECT
      COUNT(*) AS totalCheckins,
      COUNT(DISTINCT aluno_id) AS alunosDistinct

    FROM checkins

    WHERE academia_id = ?
      AND data_checkin >= (?)::timestamp
      AND data_checkin < (?)::timestamp
  `, [
    academia,
    inicioUTC,
    fimUTCExclusivo,
  ]);

  const checkinsPeriodoLista = await runAll(`
    SELECT
      c.id,
      c.aluno_id,
      c.data_checkin,
      c.status,
      c.observacoes,
      a.nome AS aluno_nome,

      (
        SELECT COUNT(*)
        FROM checkins c2

        WHERE c2.academia_id = c.academia_id
          AND c2.aluno_id = c.aluno_id
          AND c2.data_checkin >= (?)::timestamp
          AND c2.data_checkin < (?)::timestamp
      ) AS total_checkins_periodo

    FROM checkins c

    JOIN alunos a
      ON a.id = c.aluno_id
     AND a.academia_id = c.academia_id

    WHERE c.academia_id = ?
      AND c.data_checkin >= (?)::timestamp
      AND c.data_checkin < (?)::timestamp

    ORDER BY c.data_checkin DESC
  `, [
    inicioUTC,
    fimUTCExclusivo,
    academia,
    inicioUTC,
    fimUTCExclusivo,
  ]);

  // ==========================================
  // 4. PLANOS
  // ==========================================

  const resumoPlanosRow = await runGet(`
    SELECT
      COUNT(*) AS totalCadastrados,

      COALESCE(SUM(
        CASE WHEN status = 'ativo'
        THEN 1 ELSE 0 END
      ), 0) AS ativos

    FROM planos
    WHERE academia_id = ?
  `, [academia]);

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
      ), 0) AS contratadosNoPeriodo,

      COALESCE(SUM(
        CASE
          WHEN substr(m.data_inicio, 1, 10) >= ?
           AND substr(m.data_inicio, 1, 10) < ?
          THEN COALESCE(m.valor_pago, 0)
          ELSE 0
        END
      ), 0) AS valorContratadoPlano,

      COUNT(m.id) AS totalMatriculas

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
      contratadosNoPeriodo DESC,
      totalMatriculas DESC,
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

  const finRow = await runGet(`
    SELECT

      COALESCE(SUM(
        CASE
          WHEN status = 'pago'
           AND data_pagamento >= (?)::timestamp
           AND data_pagamento < (?)::timestamp
          THEN COALESCE(valor, 0)
          ELSE 0
        END
      ), 0) AS totalRecebido,

      COALESCE(SUM(
        CASE
          WHEN status = 'pago'
           AND data_pagamento >= (?)::timestamp
           AND data_pagamento < (?)::timestamp
          THEN 1 ELSE 0
        END
      ), 0) AS confirmados,

      COALESCE(SUM(
        CASE
          WHEN status = 'pendente'
           AND criado_em >= (?)::timestamp
           AND criado_em < (?)::timestamp
          THEN 1 ELSE 0
        END
      ), 0) AS pendentes,

      COALESCE(SUM(
        CASE
          WHEN status = 'pendente'
           AND criado_em >= (?)::timestamp
           AND criado_em < (?)::timestamp
          THEN COALESCE(valor, 0)
          ELSE 0
        END
      ), 0) AS valorPendente,

      COALESCE(SUM(
        CASE
          WHEN status IN ('pendente', 'vencido')
           AND data_vencimento IS NOT NULL
           AND substr(data_vencimento, 1, 10) < ?
          THEN COALESCE(valor, 0)
          ELSE 0
        END
      ), 0) AS valorVencido

    FROM movimentacoes_financeiras

    WHERE academia_id = ?
      AND tipo = 'venda'
  `, [
    inicioUTC,
    fimUTCExclusivo,
    inicioUTC,
    fimUTCExclusivo,
    inicioUTC,
    fimUTCExclusivo,
    inicioUTC,
    fimUTCExclusivo,
    fimExclusivoYMD,
    academia,
  ]);

  const formasRows = await runAll(`
    SELECT
      forma_pagamento,
      COALESCE(SUM(valor), 0) AS total

    FROM movimentacoes_financeiras

    WHERE academia_id = ?
      AND tipo = 'venda'
      AND status = 'pago'
      AND data_pagamento >= (?)::timestamp
      AND data_pagamento < (?)::timestamp

    GROUP BY forma_pagamento
  `, [
    academia,
    inicioUTC,
    fimUTCExclusivo,
  ]);

  const historicoRows = await runAll(`
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
          AND data_pagamento >= (?)::timestamp
          AND data_pagamento < (?)::timestamp
        )
        OR
        (
          status <> 'pago'
          AND criado_em >= (?)::timestamp
          AND criado_em < (?)::timestamp
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
  ]);

  const formasPagamento = {};

  formasRows.forEach((item) => {
    const forma = item.forma_pagamento || 'Não informado';

    formasPagamento[forma] = numero(item.total);
  });

  const resumoFinanceiro = {
    disponivel: true,

    valorContratadoPeriodo: numero(
      resumoMatriculasRow?.valorContratadoPeriodo
    ),

    totalRecebido: numero(finRow?.totalRecebido),
    confirmados: numero(finRow?.confirmados),
    pendentes: numero(finRow?.pendentes),
    valorPendente: numero(finRow?.valorPendente),
    valorVencido: numero(finRow?.valorVencido),

    formas_pagamento: formasPagamento,
    historico: historicoRows,

    observacao:
      'Recebidos pela data de pagamento; ' +
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
      novosHoje: numero(resumoAlunosRow?.novosNoPeriodo),
      novosNoPeriodo: numero(resumoAlunosRow?.novosNoPeriodo),
      ativos: numero(resumoAlunosRow?.ativos),
      inativos: numero(resumoAlunosRow?.inativos),
      lista: alunosPeriodoLista,
    },

    resumoMatriculas: {
      totalHoje: numero(resumoMatriculasRow?.totalNoPeriodo),
      totalNoPeriodo: numero(
        resumoMatriculasRow?.totalNoPeriodo
      ),
      vencidasHoje: numero(
        resumoMatriculasRow?.vencidasNoPeriodo
      ),
      vencidasNoPeriodo: numero(
        resumoMatriculasRow?.vencidasNoPeriodo
      ),
      canceladasHoje: null,
      ativas: numero(resumoMatriculasRow?.ativas),
      valorContratadoPeriodo: numero(
        resumoMatriculasRow?.valorContratadoPeriodo
      ),
      lista: matriculasPeriodoLista,
    },

    resumoFrequencia: {
      totalCheckins: numero(
        resumoFrequenciaRow?.totalCheckins
      ),
      alunosDistinct: numero(
        resumoFrequenciaRow?.alunosDistinct
      ),
      lista: checkinsPeriodoLista,
    },

    resumoPlanos: {
      totalCadastrados: numero(
        resumoPlanosRow?.totalCadastrados
      ),
      ativos: numero(resumoPlanosRow?.ativos),
      totalContratados: totalContratadosPeriodo,
      porPlano: planosPorContratacao,
    },

    resumoFinanceiro,
  };
};

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
  getDataHojeFortaleza,
  TIPOS_RELATORIO,
  PERIODOS_SUPORTADOS,
};
