import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import api from '../api';
import '../styles/styles.css';
import '../styles/dashboard.css';

const formatarMoeda = (valor) => {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarDataBR = (valor) => {
  if (!valor) return '—';
  const str = String(valor).trim();
  const matchData = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchData && !str.includes('T') && !str.includes(':')) {
    return `${matchData[3]}/${matchData[2]}/${matchData[1]}`;
  }
  const d = new Date(str.includes(' ') && !str.includes('T') ? `${str.replace(' ', 'T')}Z` : str);
  if (Number.isNaN(d.getTime())) return str;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

const formatarHoraBR = (valor) => {
  if (!valor) return '—';
  const str = String(valor).trim();
  const d = new Date(str.includes(' ') && !str.includes('T') ? `${str.replace(' ', 'T')}Z` : str);
  if (Number.isNaN(d.getTime())) return str;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

const hojeFortalezaISO = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = partes.find((p) => p.type === 'year')?.value;
  const m = partes.find((p) => p.type === 'month')?.value;
  const d = partes.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_alunos: 0,
    alunos_ativos: 0,
    total_planos: 0,
    total_matriculas: 0,
    matriculas_ativas: 0,
  });
  const [matriculasRaw, setMatriculasRaw] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const hojeISO = hojeFortalezaISO();
  const [tipoRelatorio, setTipoRelatorio] = useState('geral');
  const [periodoSelecionado, setPeriodoSelecionado] = useState('hoje');
  const [dataInicio, setDataInicio] = useState(hojeISO);
  const [dataFim, setDataFim] = useState(hojeISO);
  const [abaDetalhe, setAbaDetalhe] = useState('alunos');
  const [relatorio, setRelatorio] = useState(null);
  const [relatorioCarregando, setRelatorioCarregando] = useState(false);
  const [relatorioErro, setRelatorioErro] = useState('');
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  const carregarStats = useCallback(async () => {
    try {
      const [alunosRes, planosRes, matriculasRes] = await Promise.all([
        api.get('/alunos'),
        api.get('/planos'),
        api.get('/matriculas'),
      ]);
      const alunos = alunosRes.data || [];
      const planos = planosRes.data || [];
      const matriculas = matriculasRes.data || [];

      setMatriculasRaw(matriculas);
      setStats({
        total_alunos: alunos.length,
        alunos_ativos: alunos.filter((a) => a.status === 'ativo').length,
        total_planos: planos.length,
        total_matriculas: matriculas.length,
        matriculas_ativas: matriculas.filter((m) => m.status === 'ativo').length,
      });
    } catch {
      setErro('Erro ao carregar estatísticas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const montarParamsRelatorio = useCallback(
    (tipoOverride, periodoOverride, iniOverride, fimOverride) => {
      const tipo = tipoOverride ?? tipoRelatorio;
      const periodo = periodoOverride ?? periodoSelecionado;
      const ini = iniOverride ?? dataInicio;
      const fim = fimOverride ?? dataFim;

      const params = { tipo, periodo };
      if (periodo === 'personalizado') {
        params.dataInicio = ini;
        params.dataFim = fim;
      }
      return params;
    },
    [tipoRelatorio, periodoSelecionado, dataInicio, dataFim]
  );

  const carregarRelatorio = useCallback(
    async (tipoOverride, periodoOverride, iniOverride, fimOverride) => {
      const params = montarParamsRelatorio(tipoOverride, periodoOverride, iniOverride, fimOverride);
      setRelatorioCarregando(true);
      setRelatorioErro('');
      try {
        const res = await api.get('/relatorios', { params });
        setRelatorio(res.data?.dados || null);
      } catch (e) {
        const msg = e?.response?.data?.mensagem || 'Erro ao carregar relatório gerencial.';
        setRelatorioErro(msg);
      } finally {
        setRelatorioCarregando(false);
      }
    },
    [montarParamsRelatorio]
  );

  useEffect(() => {
    carregarStats();
    carregarRelatorio('geral', 'hoje', hojeISO, hojeISO);
  }, [carregarStats, carregarRelatorio, hojeISO]);

  const handleTipoChange = (novoTipo) => {
    setTipoRelatorio(novoTipo);
    if (novoTipo === 'financeiro') setAbaDetalhe('financeiro');
    else if (novoTipo === 'alunos') setAbaDetalhe('alunos');
    else if (novoTipo === 'matriculas') setAbaDetalhe('matriculas');
    else if (novoTipo === 'frequencia') setAbaDetalhe('frequencia');
    else if (novoTipo === 'planos') setAbaDetalhe('planos');
    else setAbaDetalhe('alunos');

    carregarRelatorio(novoTipo, periodoSelecionado, dataInicio, dataFim);
  };

  const handlePeriodoChange = (novoPeriodo) => {
    setPeriodoSelecionado(novoPeriodo);
    if (novoPeriodo !== 'personalizado') {
      carregarRelatorio(tipoRelatorio, novoPeriodo, dataInicio, dataFim);
    }
  };

  const handleGerarPDF = async () => {
    setBaixandoPdf(true);
    setRelatorioErro('');
    try {
      const params = montarParamsRelatorio();
      const response = await api.get('/relatorios/pdf', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const nomeBase = `relatorio-${tipoRelatorio}-${params.dataInicio || periodoSelecionado}.pdf`;
      link.href = url;
      link.setAttribute('download', nomeBase);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) {
        setRelatorioErro('Acesso negado: apenas administradores podem gerar o PDF.');
      } else {
        setRelatorioErro(e?.response?.data?.mensagem || 'Não foi possível gerar o PDF do relatório.');
      }
    } finally {
      setBaixandoPdf(false);
    }
  };

  const dadosFaturamentoMensal = (() => {
    const meses = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    const agrupado = {};

    matriculasRaw.forEach((m) => {
      if (!m.data_inicio) return;
      const data = new Date(`${String(m.data_inicio).slice(0, 10)}T00:00:00`);
      if (Number.isNaN(data.getTime())) return;
      const mesNome = meses[data.getMonth()];
      agrupado[mesNome] = (agrupado[mesNome] || 0) + (parseFloat(m.valor_pago) || 0);
    });

    const resultado = Object.keys(agrupado).map((mes) => ({
      mes,
      faturamento: agrupado[mes],
    }));

    return resultado.length > 0 ? resultado : [{ mes: 'Atual', faturamento: 0 }];
  })();

  const dadosStatus = [
    {
      status: 'Ativas',
      quantidade: matriculasRaw.filter((m) => m.status === 'ativo').length,
      cor: '#22c55e',
    },
    {
      status: 'Vencidas',
      quantidade: matriculasRaw.filter((m) => m.status === 'vencido').length,
      cor: '#ef4444',
    },
    {
      status: 'Canceladas',
      quantidade: matriculasRaw.filter((m) => m.status === 'cancelado').length,
      cor: '#64748b',
    },
  ];

  if (carregando) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando painel...
      </div>
    );
  }

  const alunosLista = relatorio?.resumoAlunos?.lista || [];
  const matriculasLista = relatorio?.resumoMatriculas?.lista || [];
  const checkinsLista = relatorio?.resumoFrequencia?.lista || [];
  const planosLista = relatorio?.resumoPlanos?.porPlano || [];
  const financeiro = relatorio?.resumoFinanceiro;

  return (
    <div className="dashboard-container" style={{ padding: '0 1.5rem', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral do sistema Wc Fit</p>
        </div>
      </div>

      {erro && (
        <div
          style={{
            padding: '1rem',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            marginBottom: '1.5rem',
          }}
        >
          {erro}
        </div>
      )}

      {/* Grid de Estatísticas Existentes */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderTop: '4px solid #2563eb' }}>
          <h3 style={{ margin: 0, fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>
            Total de Alunos
          </h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#1e293b' }}>
            {stats.total_alunos}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Alunos cadastrados</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #7c3aed' }}>
          <h3 style={{ margin: 0, fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>
            Planos Cadastrados
          </h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#7c3aed' }}>
            {stats.total_planos}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Planos disponíveis</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #0891b2' }}>
          <h3 style={{ margin: 0, fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>
            Matrículas Ativas
          </h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#0891b2' }}>
            {stats.matriculas_ativas}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Com plano vigente</div>
        </div>
      </div>

      {/* Gráficos Existentes */}
      <div className="dashboard-grid-charts">
        <div
          style={{
            background: '#fff',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#1e293b', fontSize: '1rem' }}>
            Evolução de Receita (R$)
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={dadosFaturamentoMensal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="corFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip formatter={(value) => [formatarMoeda(value), 'Receita']} />
                <Area
                  type="monotone"
                  dataKey="faturamento"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#corFaturamento)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#1e293b', fontSize: '1rem' }}>
            Status das Matrículas
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={dadosStatus} margin={{ top: 10, right: 20, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" stroke="#64748b" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                <Tooltip formatter={(value) => [`${value} matrícula(s)`, 'Total']} />
                <Bar dataKey="quantidade" radius={[6, 6, 0, 0]}>
                  {dadosStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Seção: Relatórios Gerenciais */}
      <section className="relatorios-section" aria-label="Relatórios Gerenciais">
        <div className="relatorios-header">
          <div>
            <span className="relatorios-badge">Inteligência Operacional • Wc Fit</span>
            <h2 className="relatorios-title">Relatórios Gerenciais</h2>
            <p className="relatorios-subtitle">
              {relatorio
                ? `${relatorio.descricaoPeriodo}: ${formatarDataBR(relatorio.dataInicio)} até ${formatarDataBR(
                    relatorio.dataFim
                  )} (${relatorio.timezone || 'America/Fortaleza'})`
                : 'Selecione tipo e período para consultar'}
            </p>
          </div>

          <div className="relatorios-controles">
            <select
              aria-label="Tipo de relatório"
              className="relatorios-select"
              value={tipoRelatorio}
              onChange={(e) => handleTipoChange(e.target.value)}
            >
              <option value="geral">Relatório Geral (Tudo)</option>
              <option value="financeiro">Financeiro</option>
              <option value="alunos">Alunos</option>
              <option value="matriculas">Matrículas</option>
              <option value="frequencia">Frequência</option>
              <option value="planos">Planos</option>
            </select>

            <select
              aria-label="Período de consulta"
              className="relatorios-select"
              value={periodoSelecionado}
              onChange={(e) => handlePeriodoChange(e.target.value)}
            >
              <option value="hoje">Hoje</option>
              <option value="esta_semana">Esta semana</option>
              <option value="este_mes">Este mês</option>
              <option value="mes_anterior">Mês anterior</option>
              <option value="ultimos_3_meses">Últimos 3 meses</option>
              <option value="ultimos_6_meses">Últimos 6 meses</option>
              <option value="este_ano">Este ano</option>
              <option value="personalizado">Período personalizado</option>
            </select>

            {periodoSelecionado === 'personalizado' && (
              <>
                <label className="relatorios-date-label">
                  De:
                  <input
                    type="date"
                    className="relatorios-date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </label>
                <label className="relatorios-date-label">
                  Até:
                  <input
                    type="date"
                    className="relatorios-date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </label>
              </>
            )}

            <button
              type="button"
              className="relatorios-btn relatorios-btn-secundario"
              onClick={() => carregarRelatorio(tipoRelatorio, periodoSelecionado, dataInicio, dataFim)}
              disabled={relatorioCarregando}
            >
              {relatorioCarregando ? 'Consultando...' : 'Atualizar'}
            </button>

            <button
              type="button"
              className="relatorios-btn relatorios-btn-imprimir"
              onClick={() => window.print()}
              disabled={!relatorio}
            >
              Imprimir
            </button>

            <button
              type="button"
              className="relatorios-btn relatorios-btn-primario"
              onClick={handleGerarPDF}
              disabled={baixandoPdf || relatorioCarregando}
            >
              {baixandoPdf ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>
        </div>

        <div className="relatorios-body">
          {relatorioCarregando && (
            <div className="relatorio-vazio">Carregando dados do relatório...</div>
          )}

          {relatorioErro && <div className="relatorio-aviso-box">{relatorioErro}</div>}

          {!relatorioCarregando && relatorio && (
            <>
              {/* Cartões de Indicadores */}
              <div className="relatorios-kpis">
                {(tipoRelatorio === 'geral' || tipoRelatorio === 'alunos') && (
                  <div className="relatorio-kpi-card" style={{ borderLeftColor: '#2563eb' }}>
                    <div className="relatorio-kpi-label">Novos Alunos</div>
                    <div className="relatorio-kpi-valor">{relatorio.resumoAlunos?.novosNoPeriodo ?? 0}</div>
                    <div className="relatorio-kpi-sub">
                      Base: {relatorio.resumoAlunos?.totalPeriodo ?? 0} ({relatorio.resumoAlunos?.ativos ?? 0} ativos)
                    </div>
                  </div>
                )}

                {(tipoRelatorio === 'geral' || tipoRelatorio === 'matriculas' || tipoRelatorio === 'financeiro') && (
                  <div className="relatorio-kpi-card" style={{ borderLeftColor: '#0891b2' }}>
                    <div className="relatorio-kpi-label">Matrículas no Período</div>
                    <div className="relatorio-kpi-valor">{relatorio.resumoMatriculas?.totalNoPeriodo ?? 0}</div>
                    <div className="relatorio-kpi-sub">
                      Ativas agora: {relatorio.resumoMatriculas?.ativas ?? 0}
                    </div>
                  </div>
                )}

                {(tipoRelatorio === 'geral' || tipoRelatorio === 'matriculas') && (
                  <div className="relatorio-kpi-card" style={{ borderLeftColor: '#ef4444' }}>
                    <div className="relatorio-kpi-label">Vencimentos no Período</div>
                    <div className="relatorio-kpi-valor">{relatorio.resumoMatriculas?.vencidasNoPeriodo ?? 0}</div>
                    <div className="relatorio-kpi-sub">Vencidas / a vencer no intervalo</div>
                  </div>
                )}

                {(tipoRelatorio === 'geral' || tipoRelatorio === 'frequencia') && (
                  <>
                    <div className="relatorio-kpi-card" style={{ borderLeftColor: '#7c3aed' }}>
                      <div className="relatorio-kpi-label">Total de Check-ins</div>
                      <div className="relatorio-kpi-valor">{relatorio.resumoFrequencia?.totalCheckins ?? 0}</div>
                      <div className="relatorio-kpi-sub">Entradas registradas</div>
                    </div>
                    <div className="relatorio-kpi-card" style={{ borderLeftColor: '#16a34a' }}>
                      <div className="relatorio-kpi-label">Alunos Presentes</div>
                      <div className="relatorio-kpi-valor">{relatorio.resumoFrequencia?.alunosDistinct ?? 0}</div>
                      <div className="relatorio-kpi-sub">Alunos distintos</div>
                    </div>
                  </>
                )}

                {(tipoRelatorio === 'geral' || tipoRelatorio === 'planos' || tipoRelatorio === 'financeiro') && (
                  <div className="relatorio-kpi-card" style={{ borderLeftColor: '#d97706' }}>
                    <div className="relatorio-kpi-label">Planos Contratados</div>
                    <div className="relatorio-kpi-valor">{relatorio.resumoPlanos?.totalContratados ?? 0}</div>
                    <div className="relatorio-kpi-sub">
                      Cadastrados: {relatorio.resumoPlanos?.totalCadastrados ?? 0}
                    </div>
                  </div>
                )}

                {(tipoRelatorio === 'geral' || tipoRelatorio === 'financeiro') && (
                  <div className="relatorio-kpi-card" style={{ borderLeftColor: '#059669' }}>
                    <div className="relatorio-kpi-label">
                      {financeiro?.disponivel ? 'Total Recebido' : 'Valor Contratado (Período)'}
                    </div>
                    <div className="relatorio-kpi-valor">
                      {financeiro?.disponivel
                        ? formatarMoeda(financeiro.totalRecebido)
                        : formatarMoeda(financeiro?.valorContratadoPeriodo ?? 0)}
                    </div>
                    <div className="relatorio-kpi-sub">
                      {financeiro?.disponivel
                        ? `${financeiro.confirmados} confirmado(s)`
                        : 'Sem tabela de pagamentos'}
                    </div>
                  </div>
                )}
              </div>

              {(tipoRelatorio === 'geral' || tipoRelatorio === 'financeiro') &&
                financeiro &&
                !financeiro.disponivel && (
                  <div className="relatorio-aviso-box">
                    <strong>Financeiro:</strong> {financeiro.observacao}
                  </div>
                )}

              {/* Abas de Detalhamento */}
              <div className="relatorio-tabs" role="tablist">
                <button
                  type="button"
                  className={`relatorio-tab ${abaDetalhe === 'alunos' ? 'ativa' : ''}`}
                  onClick={() => setAbaDetalhe('alunos')}
                >
                  Alunos ({alunosLista.length})
                </button>
                <button
                  type="button"
                  className={`relatorio-tab ${abaDetalhe === 'matriculas' ? 'ativa' : ''}`}
                  onClick={() => setAbaDetalhe('matriculas')}
                >
                  Matrículas ({matriculasLista.length})
                </button>
                <button
                  type="button"
                  className={`relatorio-tab ${abaDetalhe === 'frequencia' ? 'ativa' : ''}`}
                  onClick={() => setAbaDetalhe('frequencia')}
                >
                  Frequência ({checkinsLista.length})
                </button>
                <button
                  type="button"
                  className={`relatorio-tab ${abaDetalhe === 'planos' ? 'ativa' : ''}`}
                  onClick={() => setAbaDetalhe('planos')}
                >
                  Planos ({planosLista.length})
                </button>
                <button
                  type="button"
                  className={`relatorio-tab ${abaDetalhe === 'financeiro' ? 'ativa' : ''}`}
                  onClick={() => setAbaDetalhe('financeiro')}
                >
                  Financeiro
                </button>
              </div>

              {abaDetalhe === 'alunos' && (
                <div className="relatorio-tabela-wrapper">
                  {alunosLista.length === 0 ? (
                    <div className="relatorio-vazio">Nenhum aluno cadastrado no período selecionado.</div>
                  ) : (
                    <table className="relatorio-tabela">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>CPF</th>
                          <th>Telefone</th>
                          <th>Data de Cadastro</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alunosLista.map((a) => (
                          <tr key={a.id}>
                            <td>{a.nome}</td>
                            <td>{a.cpf || '—'}</td>
                            <td>{a.telefone || '—'}</td>
                            <td>{formatarDataBR(a.criado_em)}</td>
                            <td>{a.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {abaDetalhe === 'matriculas' && (
                <div className="relatorio-tabela-wrapper">
                  {matriculasLista.length === 0 ? (
                    <div className="relatorio-vazio">Nenhuma matrícula iniciada no período selecionado.</div>
                  ) : (
                    <table className="relatorio-tabela">
                      <thead>
                        <tr>
                          <th>Aluno</th>
                          <th>Plano</th>
                          <th>Início</th>
                          <th>Vencimento</th>
                          <th>Valor</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matriculasLista.map((m) => (
                          <tr key={m.id}>
                            <td>{m.aluno_nome}</td>
                            <td>{m.plano_nome}</td>
                            <td>{formatarDataBR(m.data_inicio)}</td>
                            <td>{formatarDataBR(m.data_vencimento)}</td>
                            <td>{formatarMoeda(m.valor_pago)}</td>
                            <td>{m.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {abaDetalhe === 'frequencia' && (
                <div className="relatorio-tabela-wrapper">
                  {checkinsLista.length === 0 ? (
                    <div className="relatorio-vazio">Nenhum check-in registrado no período selecionado.</div>
                  ) : (
                    <table className="relatorio-tabela">
                      <thead>
                        <tr>
                          <th>Aluno</th>
                          <th>Data e Hora</th>
                          <th>Check-ins no Período</th>
                          <th>Observações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checkinsLista.map((c) => (
                          <tr key={c.id}>
                            <td>{c.aluno_nome}</td>
                            <td>
                              {formatarDataBR(c.data_checkin)} {formatarHoraBR(c.data_checkin)}
                            </td>
                            <td>{c.total_checkins_periodo ?? 1}</td>
                            <td>{c.observacoes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {abaDetalhe === 'planos' && (
                <div className="relatorio-tabela-wrapper">
                  {planosLista.length === 0 ? (
                    <div className="relatorio-vazio">Nenhum plano cadastrado.</div>
                  ) : (
                    <table className="relatorio-tabela">
                      <thead>
                        <tr>
                          <th>Plano</th>
                          <th>Preço</th>
                          <th>Contratados no Período</th>
                          <th>Valor Contratado</th>
                          <th>Total Histórico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planosLista.map((p) => (
                          <tr key={p.id}>
                            <td>{p.nome}</td>
                            <td>{formatarMoeda(p.preco)}</td>
                            <td>{p.contratadosNoPeriodo ?? 0}</td>
                            <td>{formatarMoeda(p.valorContratadoPlano ?? 0)}</td>
                            <td>{p.totalMatriculas ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {abaDetalhe === 'financeiro' && (
                <div className="relatorio-tabela-wrapper">
                  <div style={{ padding: '1rem' }}>
                    <p style={{ margin: '0 0 0.75rem', color: '#1e293b' }}>
                      <strong>Valor contratado nas matrículas do período:</strong>{' '}
                      {formatarMoeda(financeiro?.valorContratadoPeriodo ?? 0)}
                    </p>
                    {financeiro?.disponivel ? (
                      <p style={{ margin: 0, color: '#065f46' }}>
                        <strong>Total recebido:</strong> {formatarMoeda(financeiro.totalRecebido)} •{' '}
                        <strong>Confirmados:</strong> {financeiro.confirmados} •{' '}
                        <strong>Pendentes:</strong> {financeiro.pendentes}
                      </p>
                    ) : (
                      <p style={{ margin: 0, color: '#92400e', fontSize: '0.86rem' }}>
                        {financeiro?.observacao}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}