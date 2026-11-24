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

const formatarYMD = (ano, mes1Based, dia) => {
  const dt = new Date(Date.UTC(ano, mes1Based - 1, dia));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const adicionarDiasYMD = (ymd, deltaDias) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return formatarYMD(y, m, d + deltaDias);
};

const adicionarMesesYMD = (ymd, deltaMeses) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return formatarYMD(y, m + deltaMeses, d);
};

/**
 * Obtém a data atual (YYYY-MM-DD) no fuso America/Fortaleza
 */
const getDataHojeFortaleza = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const ano = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value;
  const dia = partes.find((p) => p.type === 'day')?.value;
  return `${ano}-${mes}-${dia}`;
};

/**
 * Converte uma data/hora local de America/Fortaleza (UTC-3 fixo) para string UTC (YYYY-MM-DD HH:mm:ss)
 */
const fortalezaLocalParaUTC = (dataStr, horaStr = '00:00:00') => {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const [hh, mm, ss] = horaStr.split(':').map(Number);
  const utcDate = new Date(Date.UTC(ano, mes - 1, dia, hh + 3, mm, ss));
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  const h = String(utcDate.getUTCHours()).padStart(2, '0');
  const min = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const sec = String(utcDate.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${sec}`;
};

const validarDataYMD = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim());

/**
 * Resolve intervalo inclusivo [dataInicio, dataFimExclusivo) no fuso America/Fortaleza
 */
const resolverIntervaloPeriodo = (periodo = 'hoje', dataInicioCustom, dataFimCustom) => {
  const hoje = getDataHojeFortaleza();
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number);

  let inicioInclusivo = hoje;
  let fimInclusivo = hoje;
  let descricaoPeriodo = 'Hoje';

  switch (periodo) {
    case 'hoje': {
      inicioInclusivo = hoje;
      fimInclusivo = hoje;
      descricaoPeriodo = 'Hoje';
      break;
    }
    case 'esta_semana': {
      // Segunda-feira como início da semana no padrão BR
      const diaSemanaUTC = new Date(Date.UTC(anoHoje, mesHoje - 1, diaHoje)).getUTCDay();
      const diffSegunda = diaSemanaUTC === 0 ? -6 : 1 - diaSemanaUTC;
      inicioInclusivo = adicionarDiasYMD(hoje, diffSegunda);
      fimInclusivo = hoje;
      descricaoPeriodo = 'Esta semana';
      break;
    }
    case 'este_mes': {
      inicioInclusivo = formatarYMD(anoHoje, mesHoje, 1);
      fimInclusivo = hoje;
      descricaoPeriodo = 'Este mês';
      break;
    }
    case 'mes_anterior': {
      inicioInclusivo = formatarYMD(anoHoje, mesHoje - 1, 1);
      // Último dia do mês anterior = dia 0 do mês atual
      const ultimoDiaMesAnterior = new Date(Date.UTC(anoHoje, mesHoje - 1, 0));
      fimInclusivo = formatarYMD(
        ultimoDiaMesAnterior.getUTCFullYear(),
        ultimoDiaMesAnterior.getUTCMonth() + 1,
        ultimoDiaMesAnterior.getUTCDate()
      );
      descricaoPeriodo = 'Mês anterior';
      break;
    }
    case 'ultimos_3_meses': {
      inicioInclusivo = adicionarMesesYMD(hoje, -3);
      fimInclusivo = hoje;
      descricaoPeriodo = 'Últimos 3 meses';
      break;
    }
    case 'ultimos_6_meses': {
      inicioInclusivo = adicionarMesesYMD(hoje, -6);
      fimInclusivo = hoje;
      descricaoPeriodo = 'Últimos 6 meses';
      break;
    }
    case 'este_ano': {
      inicioInclusivo = formatarYMD(anoHoje, 1, 1);
      fimInclusivo = hoje;
      descricaoPeriodo = 'Este ano';
      break;
    }
    case 'personalizado': {
      if (!validarDataYMD(dataInicioCustom) || !validarDataYMD(dataFimCustom)) {
        const err = new Error('Informe data inicial e data final válidas (AAAA-MM-DD) para período personalizado.');
        err.statusCode = 400;
        throw err;
      }
      inicioInclusivo = dataInicioCustom.trim();
      fimInclusivo = dataFimCustom.trim();
      if (inicioInclusivo > fimInclusivo) {
        const err = new Error('A data inicial não pode ser maior que a data final.');
        err.statusCode = 400;
        throw err;
      }
      descricaoPeriodo = 'Período personalizado';
      break;
    }
    default: {
      const err = new Error('Período inválido.');
      err.statusCode = 400;
      throw err;
    }
  }

  const fimExclusivoYMD = adicionarDiasYMD(fimInclusivo, 1);

  return {
    periodo,
    descricaoPeriodo,
    dataInicio: inicioInclusivo,
    dataFim: fimInclusivo,
    fimExclusivoYMD,
    inicioUTC: fortalezaLocalParaUTC(inicioInclusivo, '00:00:00'),
    fimUTCExclusivo: fortalezaLocalParaUTC(fimExclusivoYMD, '00:00:00'),
  };
};

const runAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

const runGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

const obterDadosRelatorio = async ({
  tipo = 'geral',
  periodo = 'hoje',
  dataInicio,
  dataFim,
} = {}) => {
  const tipoNormalizado = String(tipo || 'geral').toLowerCase();
  if (!TIPOS_RELATORIO.includes(tipoNormalizado)) {
    const err = new Error('Tipo de relatório inválido.');
    err.statusCode = 400;
    throw err;
  }

  const periodoNormalizado = String(periodo || 'hoje').toLowerCase();
  if (!PERIODOS_SUPORTADOS.includes(periodoNormalizado)) {
    const err = new Error('Período inválido.');
    err.statusCode = 400;
    throw err;
  }

  const intervalo = resolverIntervaloPeriodo(periodoNormalizado, dataInicio, dataFim);
  const {
    descricaoPeriodo,
    dataInicio: dtIni,
    dataFim: dtFim,
    fimExclusivoYMD,
    inicioUTC,
    fimUTCExclusivo,
  } = intervalo;

  // 1. Alunos
  const resumoAlunosRow = await runGet(
    `
    SELECT
      COUNT(*) AS totalBase,
      COALESCE(SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END), 0) AS ativos,
      COALESCE(SUM(CASE WHEN status != 'ativo' THEN 1 ELSE 0 END), 0) AS inativos,
      COALESCE(SUM(CASE WHEN (criado_em)::timestamp >= (?)::timestamp AND (criado_em)::timestamp < (?)::timestamp THEN 1 ELSE 0 END), 0) AS novosNoPeriodo
    FROM alunos
  `,
    [inicioUTC, fimUTCExclusivo]
  );

  const alunosPeriodoLista = await runAll(
    `
    SELECT id, nome, cpf, telefone, email, status, criado_em
    FROM alunos
    WHERE (criado_em)::timestamp >= (?)::timestamp AND (criado_em)::timestamp < (?)::timestamp
    ORDER BY (criado_em)::timestamp DESC
  `,
    [inicioUTC, fimUTCExclusivo]
  );

  // 2. Matrículas
  const resumoMatriculasRow = await runGet(
    `
    SELECT
      COALESCE(SUM(CASE WHEN substr(data_inicio, 1, 10) >= ? AND substr(data_inicio, 1, 10) < ? THEN 1 ELSE 0 END), 0) AS totalNoPeriodo,
      COALESCE(SUM(CASE WHEN substr(data_vencimento, 1, 10) >= ? AND substr(data_vencimento, 1, 10) < ? THEN 1 ELSE 0 END), 0) AS vencidasNoPeriodo,
      COALESCE(SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END), 0) AS ativas,
      COALESCE(SUM(CASE WHEN substr(data_inicio, 1, 10) >= ? AND substr(data_inicio, 1, 10) < ? THEN COALESCE(valor_pago, 0) ELSE 0 END), 0) AS valorContratadoPeriodo
    FROM matriculas
  `,
    [dtIni, fimExclusivoYMD, dtIni, fimExclusivoYMD, dtIni, fimExclusivoYMD]
  );

  const matriculasPeriodoLista = await runAll(
    `
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
    JOIN alunos a ON m.aluno_id = a.id
    JOIN planos p ON m.plano_id = p.id
    WHERE substr(m.data_inicio, 1, 10) >= ? AND substr(m.data_inicio, 1, 10) < ?
    ORDER BY (m.criado_em)::timestamp DESC
  `,
    [dtIni, fimExclusivoYMD]
  );

  // 3. Frequência
  const resumoFrequenciaRow = await runGet(
    `
    SELECT
      COUNT(*) AS totalCheckins,
      COUNT(DISTINCT aluno_id) AS alunosDistinct
    FROM checkins
    WHERE (data_checkin)::timestamp >= (?)::timestamp AND (data_checkin)::timestamp < (?)::timestamp
  `,
    [inicioUTC, fimUTCExclusivo]
  );

  const checkinsPeriodoLista = await runAll(
    `
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
        WHERE c2.aluno_id = c.aluno_id
          AND (c2.data_checkin)::timestamp >= (?)::timestamp
          AND (c2.data_checkin)::timestamp < (?)::timestamp
      ) AS total_checkins_periodo
    FROM checkins c
    JOIN alunos a ON c.aluno_id = a.id
    WHERE (c.data_checkin)::timestamp >= (?)::timestamp AND (c.data_checkin)::timestamp < (?)::timestamp
    ORDER BY (c.data_checkin)::timestamp DESC
  `,
    [inicioUTC, fimUTCExclusivo, inicioUTC, fimUTCExclusivo]
  );

  // 4. Planos
  const resumoPlanosRow = await runGet(`
    SELECT
      COUNT(*) AS totalCadastrados,
      COALESCE(SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END), 0) AS ativos
    FROM planos
  `);

  const planosPorContratacao = await runAll(
    `
    SELECT
      p.id,
      p.nome,
      p.preco,
      p.duracao_meses,
      p.status,
      COALESCE(SUM(CASE WHEN substr(m.data_inicio, 1, 10) >= ? AND substr(m.data_inicio, 1, 10) < ? THEN 1 ELSE 0 END), 0) AS contratadosNoPeriodo,
      COALESCE(SUM(CASE WHEN substr(m.data_inicio, 1, 10) >= ? AND substr(m.data_inicio, 1, 10) < ? THEN COALESCE(m.valor_pago, 0) ELSE 0 END), 0) AS valorContratadoPlano,
      COUNT(m.id) AS totalMatriculas
    FROM planos p
    LEFT JOIN matriculas m ON m.plano_id = p.id
    GROUP BY p.id, p.nome, p.preco, p.duracao_meses, p.status
    ORDER BY contratadosNoPeriodo DESC, totalMatriculas DESC, p.nome ASC
  `,
    [dtIni, fimExclusivoYMD, dtIni, fimExclusivoYMD]
  );

  const totalContratadosPeriodo = planosPorContratacao.reduce(
    (acc, item) => acc + (Number(item.contratadosNoPeriodo) || 0),
    0
  );

  // 5. Financeiro (verifica se existe tabela pagamentos; caso contrário, não inventa valores recebidos)
  const tabelaPagamentos = await runGet(
    `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pagamentos'`
  );

  let resumoFinanceiro;
  const avisoSemTabelaPagamentos =
    'Não existe tabela independente de pagamentos ("pagamentos") no SQLite atual. O valor exibido refere-se ao valor contratado nas matrículas do período selecionado, sem inferir caixa recebido.';

  if (tabelaPagamentos) {
    const finRow = await runGet(
      `
      SELECT
        COALESCE(SUM(CASE WHEN status = 'confirmado' THEN COALESCE(valor, 0) ELSE 0 END), 0) AS totalRecebido,
        COALESCE(SUM(CASE WHEN status = 'confirmado' THEN 1 ELSE 0 END), 0) AS confirmados,
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END), 0) AS pendentes,
        COALESCE(SUM(CASE WHEN status = 'pendente' THEN COALESCE(valor, 0) ELSE 0 END), 0) AS valorPendente,
        COALESCE(SUM(CASE WHEN status = 'vencido' THEN COALESCE(valor, 0) ELSE 0 END), 0) AS valorVencido
      FROM pagamentos
      WHERE (data_pagamento)::timestamp >= (?)::timestamp AND (data_pagamento)::timestamp < (?)::timestamp
    `,
      [inicioUTC, fimUTCExclusivo]
    );

    const formasRows = await runAll(
      `
      SELECT forma_pagamento, COALESCE(SUM(valor), 0) AS total
      FROM pagamentos
      WHERE status = 'confirmado'
        AND (data_pagamento)::timestamp >= (?)::timestamp AND (data_pagamento)::timestamp < (?)::timestamp
      GROUP BY forma_pagamento
    `,
      [inicioUTC, fimUTCExclusivo]
    );

    const historicoRows = await runAll(
      `
      SELECT id, descricao, valor, forma_pagamento, status, data_pagamento
      FROM pagamentos
      WHERE (data_pagamento)::timestamp >= (?)::timestamp AND (data_pagamento)::timestamp < (?)::timestamp
      ORDER BY (data_pagamento)::timestamp DESC
      LIMIT 30
    `,
      [inicioUTC, fimUTCExclusivo]
    );

    const formasPagamento = {};
    formasRows.forEach((f) => {
      formasPagamento[f.forma_pagamento || 'Não informado'] = Number(f.total) || 0;
    });

    resumoFinanceiro = {
      disponivel: true,
      valorContratadoPeriodo: Number(resumoMatriculasRow?.valorContratadoPeriodo) || 0,
      totalRecebido: Number(finRow?.totalRecebido) || 0,
      confirmados: Number(finRow?.confirmados) || 0,
      pendentes: Number(finRow?.pendentes) || 0,
      valorPendente: Number(finRow?.valorPendente) || 0,
      valorVencido: Number(finRow?.valorVencido) || 0,
      formas_pagamento: formasPagamento,
      historico: historicoRows,
    };
  } else {
    resumoFinanceiro = {
      disponivel: false,
      valorContratadoPeriodo: Number(resumoMatriculasRow?.valorContratadoPeriodo) || 0,
      totalRecebido: null,
      confirmados: 0,
      pendentes: 0,
      valorPendente: null,
      valorVencido: null,
      formas_pagamento: {},
      historico: [],
      observacao: avisoSemTabelaPagamentos,
    };
  }

  return {
    tipo: tipoNormalizado,
    periodo: periodoNormalizado,
    descricaoPeriodo,
    timezone: TIMEZONE,
    dataInicio: dtIni,
    dataFim: dtFim,
    dataReferencia: dtIni === dtFim ? dtIni : `${dtIni} a ${dtFim}`,
    resumoAlunos: {
      totalPeriodo: Number(resumoAlunosRow?.totalBase) || 0,
      novosHoje: Number(resumoAlunosRow?.novosNoPeriodo) || 0,
      novosNoPeriodo: Number(resumoAlunosRow?.novosNoPeriodo) || 0,
      ativos: Number(resumoAlunosRow?.ativos) || 0,
      inativos: Number(resumoAlunosRow?.inativos) || 0,
      lista: alunosPeriodoLista,
    },
    resumoMatriculas: {
      totalHoje: Number(resumoMatriculasRow?.totalNoPeriodo) || 0,
      totalNoPeriodo: Number(resumoMatriculasRow?.totalNoPeriodo) || 0,
      vencidasHoje: Number(resumoMatriculasRow?.vencidasNoPeriodo) || 0,
      vencidasNoPeriodo: Number(resumoMatriculasRow?.vencidasNoPeriodo) || 0,
      canceladasHoje: null,
      ativas: Number(resumoMatriculasRow?.ativas) || 0,
      valorContratadoPeriodo: Number(resumoMatriculasRow?.valorContratadoPeriodo) || 0,
      lista: matriculasPeriodoLista,
    },
    resumoFrequencia: {
      totalCheckins: Number(resumoFrequenciaRow?.totalCheckins) || 0,
      alunosDistinct: Number(resumoFrequenciaRow?.alunosDistinct) || 0,
      lista: checkinsPeriodoLista,
    },
    resumoPlanos: {
      totalCadastrados: Number(resumoPlanosRow?.totalCadastrados) || 0,
      ativos: Number(resumoPlanosRow?.ativos) || 0,
      totalContratados: totalContratadosPeriodo,
      porPlano: planosPorContratacao,
    },
    resumoFinanceiro,
  };
};

const obterDadosRelatorioHoje = (callback) => {
  obterDadosRelatorio({ tipo: 'geral', periodo: 'hoje' })
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