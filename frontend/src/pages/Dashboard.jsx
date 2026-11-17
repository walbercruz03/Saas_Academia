import { useState, useEffect } from 'react';
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
  Cell
} from 'recharts';
import api from '../api';
import '../styles/styles.css';
import '../styles/dashboard.css';

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

  useEffect(() => {
    carregarStats();
  }, []);

  const carregarStats = async () => {
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
  };

  const formatarMoeda = (valor) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Faturamento por Mês baseado nas matrículas
  const dadosFaturamentoMensal = (() => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const agrupado = {};

    matriculasRaw.forEach((m) => {
      if (!m.data_inicio) return;
      const data = new Date(m.data_inicio + 'T00:00:00');
      const mesNome = meses[data.getMonth()];
      agrupado[mesNome] = (agrupado[mesNome] || 0) + (parseFloat(m.valor_pago) || 0);
    });

    const resultado = Object.keys(agrupado).map((mes) => ({
      mes,
      faturamento: agrupado[mes]
    }));

    return resultado.length > 0 ? resultado : [{ mes: 'Atual', faturamento: 0 }];
  })();

  // Status das Matrículas para Gráfico de Barras
  const dadosStatus = [
    { status: 'Ativas', quantidade: matriculasRaw.filter((m) => m.status === 'ativo').length, cor: '#22c55e' },
    { status: 'Vencidas', quantidade: matriculasRaw.filter((m) => m.status === 'vencido').length, cor: '#ef4444' },
    { status: 'Canceladas', quantidade: matriculasRaw.filter((m) => m.status === 'cancelado').length, cor: '#64748b' }
  ];

  if (carregando) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Carregando painel...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', padding: '0 1.5rem', boxSizing: 'border-box' }}>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral do sistema Wc Fit</p>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '1.5rem' }}>
          {erro}
        </div>
      )}

      {/* Grid de Estatísticas (KPIs) com colunas flexíveis garantidas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '1.25rem', 
        marginBottom: '2rem', 
        width: '100%' 
      }}>
        <div className="stat-card" style={{ borderTop: '4px solid #2563eb', background: '#ffffff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>Total de Alunos</h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#2563eb' }}>{stats.total_alunos}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Alunos cadastrados</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #059669', background: '#ffffff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>Alunos Ativos</h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#059669' }}>{stats.alunos_ativos}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Com status ativo</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #7c3aed', background: '#ffffff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>Planos Cadastrados</h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#7c3aed' }}>{stats.total_planos}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Planos disponíveis</div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #0891b2', background: '#ffffff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.80rem', color: '#64748b', textTransform: 'uppercase' }}>Matrículas Ativas</h3>
          <div style={{ fontSize: '1.85rem', fontWeight: '800', color: '#0891b2' }}>{stats.matriculas_ativas}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Com plano vigente</div>
        </div>
      </div>

      {/* Grid de Gráficos Interativos lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem', width: '100%' }}>
        
        {/* Gráfico 1: Evolução de Receita */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#1e293b', fontSize: '1rem' }}>Evolução de Receita (R$)</h3>
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
                <Area type="monotone" dataKey="faturamento" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#corFaturamento)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Status das Matrículas */}
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', boxSizing: 'border-box' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#1e293b', fontSize: '1rem' }}>Status das Matrículas</h3>
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
    </div>
  );
}