import { podeAcessar } from '../permissoesProfessor';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import api from '../api';
import '../styles/styles.css';
import '../styles/treinamento.css';

const ITENS_POR_PAGINA = 8;

const parseNumeroCarga = (valor) => {
  if (valor === undefined || valor === null) return null;
  const match = String(valor).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const normalizarExerciciosFicha = (rawExercicios) => {
  if (Array.isArray(rawExercicios)) return rawExercicios;
  if (typeof rawExercicios === 'string') {
    try {
      const parsed = JSON.parse(rawExercicios);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatarDataCurta = (dataStr) => {
  if (!dataStr) return '—';
  const d = new Date(String(dataStr).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(dataStr).slice(0, 10);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function AcompanhamentoTreinos() {
  const { usuario: usuarioAtual } = useAuth();
  const [execucoes, setExecucoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [treinos, setTreinos] = useState([]);

  // Modelos associados ao aluno selecionado no form
  const [modelosDoAluno, setModelosDoAluno] = useState([]);
  const [carregandoModelosAluno, setCarregandoModelosAluno] = useState(false);

  const [filtroAlunoId, setFiltroAlunoId] = useState('');
  const [exercicioEvolucao, setExercicioEvolucao] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Form de registro de execução
  const [alunoId, setAlunoId] = useState('');
  const [opcaoTreinoSelecionada, setOpcaoTreinoSelecionada] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState('50');
  const [percepcaoEsforco, setPercepcaoEsforco] = useState('7');
  const [observacao, setObservacao] = useState('');
  const [cargasSessao, setCargasSessao] = useState([]);

  // Snapshot visualizer modal
  const [snapshotVisualizar, setSnapshotVisualizar] = useState(null);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroAlunoId, exercicioEvolucao]);

  // Quando o aluno do formulário muda, carrega seus modelos de treino atribuídos
  useEffect(() => {
    if (!alunoId) {
      setModelosDoAluno([]);
      setOpcaoTreinoSelecionada('');
      setCargasSessao([]);
      return;
    }

    const buscarModelosAluno = async () => {
      setCarregandoModelosAluno(true);
      try {
        const res = await api.get(`/alunos/${alunoId}/modelos-treino`);
        setModelosDoAluno(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Erro ao buscar modelos do aluno:', err);
        setModelosDoAluno([]);
      } finally {
        setCarregandoModelosAluno(false);
      }
    };

    buscarModelosAluno();
  }, [alunoId]);

  const carregarDados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [resExec, resAlunos, resTreinos] = await Promise.all([
        api.get('/execucoes-treino').catch(() => ({ data: [] })),
        api.get('/alunos').catch(() => ({ data: [] })),
        api.get('/treinos').catch(() => ({ data: [] })),
      ]);

      const listaExec = Array.isArray(resExec.data)
        ? resExec.data
        : resExec.data?.execucoes || [];
      const listaAlunos = Array.isArray(resAlunos.data)
        ? resAlunos.data
        : resAlunos.data?.alunos || [];
      const listaTreinos = Array.isArray(resTreinos.data)
        ? resTreinos.data
        : resTreinos.data?.treinos || [];

      setExecucoes(listaExec);
      setAlunos(listaAlunos);
      setTreinos(listaTreinos);
    } catch (err) {
      console.error(err);
      setErro('Erro ao carregar dados de acompanhamento de treinos.');
    } finally {
      setCarregando(false);
    }
  };

  const treinosLegadosDoAluno = useMemo(() => {
    if (!alunoId) return [];
    return treinos.filter((t) => String(t.aluno_id ?? t.alunoId) === String(alunoId));
  }, [treinos, alunoId]);

  const handleSelecionarOpcaoTreino = (valor) => {
    setOpcaoTreinoSelecionada(valor);
    if (!valor) {
      setCargasSessao([]);
      return;
    }

    // Caso 1: Divisão de Modelo Compartilhado (formato: "modelo:{modeloId}:div:{divisaoId}")
    if (valor.startsWith('modelo:')) {
      const parts = valor.split(':');
      const modId = Number(parts[1]);
      const divId = Number(parts[3]);

      const mod = modelosDoAluno.find((m) => m.id === modId);
      const div = mod?.divisoes?.find((d) => d.id === divId);

      if (div && Array.isArray(div.exercicios)) {
        setCargasSessao(
          div.exercicios.map((ex) => ({
            exercicio_id: ex.exercicio_id || ex.id,
            nome: ex.exercicio_nome || ex.nome || 'Exercício',
            series: ex.series || '',
            repeticoes: ex.repeticoes || '',
            carga: ex.carga_sugerida || ex.carga || '',
            descanso: ex.descanso || '',
          }))
        );
      } else {
        setCargasSessao([]);
      }
    }
    // Caso 2: Ficha Legada (formato: "treino:{treinoId}")
    else if (valor.startsWith('treino:')) {
      const trId = Number(valor.split(':')[1]);
      const ficha = treinos.find((t) => Number(t.id) === trId);
      if (ficha) {
        const itens = normalizarExerciciosFicha(ficha.exercicios);
        setCargasSessao(
          itens.map((ex) => ({
            exercicio_id: ex.exercicio_id || null,
            nome: ex.nome || 'Exercício',
            series: ex.series || '',
            repeticoes: ex.repeticoes || '',
            carga: ex.carga || '',
          }))
        );
      } else {
        setCargasSessao([]);
      }
    }
  };

  const atualizarCargaItem = (index, novaCarga) => {
    setCargasSessao((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], carga: novaCarga };
      return copia;
    });
  };

  const handleRegistrarExecucao = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!alunoId || !opcaoTreinoSelecionada) {
      setErro('Selecione o aluno e a divisão de treino executada.');
      return;
    }

    setSalvando(true);
    try {
      let payload = {
        aluno_id: Number(alunoId),
        duracao_minutos: duracaoMinutos ? Number(duracaoMinutos) : null,
        percepcao_esforco: percepcaoEsforco ? Number(percepcaoEsforco) : null,
        observacao: observacao.trim() || null,
        cargas: cargasSessao,
      };

      if (opcaoTreinoSelecionada.startsWith('modelo:')) {
        const parts = opcaoTreinoSelecionada.split(':');
        const modId = Number(parts[1]);
        const divId = Number(parts[3]);
        const mod = modelosDoAluno.find((m) => m.id === modId);
        const div = mod?.divisoes?.find((d) => d.id === divId);

        payload.modelo_id = modId;
        payload.divisao_id = divId;
        payload.modelo_nome = mod?.nome || 'Modelo Compartilhado';
        payload.divisao_nome = div?.nome || 'Divisão';
        // Snapshot imutável
        payload.snapshot_treino = {
          modelo_id: modId,
          modelo_nome: mod?.nome,
          divisao_id: divId,
          divisao_nome: div?.nome,
          modalidade: mod?.modalidade_nome,
          nivel: mod?.nivel_nome,
          exercicios_registrados: cargasSessao,
          registrado_em: new Date().toISOString(),
        };
      } else if (opcaoTreinoSelecionada.startsWith('treino:')) {
        const trId = Number(opcaoTreinoSelecionada.split(':')[1]);
        payload.treino_id = trId;
      }

      await api.post('/execucoes-treino', payload);

      setSucesso('Execução de treino registrada com snapshot imutável salvo!');
      setOpcaoTreinoSelecionada('');
      setCargasSessao([]);
      setObservacao('');
      await carregarDados();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao registrar execução de treino.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluirExecucao = async (id) => {
    if (!window.confirm('Deseja realmente excluir este registro de execução?')) return;
    setErro('');
    setSucesso('');
    try {
      await api.delete(`/execucoes-treino/${id}`);
      setSucesso('Registro de execução removido.');
      await carregarDados();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao remover registro.');
    }
  };

  const execucoesFiltradas = useMemo(() => {
    if (!filtroAlunoId) return execucoes;
    return execucoes.filter((ex) => String(ex.aluno_id) === String(filtroAlunoId));
  }, [execucoes, filtroAlunoId]);

  const nomesExerciciosDisponiveis = useMemo(() => {
    const nomes = new Set();
    execucoesFiltradas.forEach((ex) => {
      (ex.cargas || []).forEach((c) => {
        if (c.nome) nomes.add(c.nome);
      });
    });
    return Array.from(nomes).sort((a, b) => a.localeCompare(b));
  }, [execucoesFiltradas]);

  const exercicioAtivoGrafico = useMemo(() => {
    if (exercicioEvolucao && nomesExerciciosDisponiveis.includes(exercicioEvolucao)) {
      return exercicioEvolucao;
    }
    return nomesExerciciosDisponiveis[0] || '';
  }, [exercicioEvolucao, nomesExerciciosDisponiveis]);

  const dadosEvolucaoCarga = useMemo(() => {
    if (!exercicioAtivoGrafico) return [];

    const ordenadas = [...execucoesFiltradas].sort(
      (a, b) => new Date(a.data_execucao || 0) - new Date(b.data_execucao || 0)
    );

    const pontos = [];
    ordenadas.forEach((exec) => {
      const match = (exec.cargas || []).find(
        (c) => String(c.nome || '').toLowerCase() === exercicioAtivoGrafico.toLowerCase()
      );
      if (!match) return;
      const cargaNum = parseNumeroCarga(match.carga);
      if (cargaNum === null) return;
      pontos.push({
        data: formatarDataCurta(exec.data_execucao),
        carga: cargaNum,
        rotuloCarga: match.carga,
      });
    });

    return pontos;
  }, [execucoesFiltradas, exercicioAtivoGrafico]);

  const indicadores = useMemo(() => {
    const totalSessoes = execucoesFiltradas.length;

    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sessoes7Dias = execucoesFiltradas.filter((e) => {
      const d = new Date(String(e.data_execucao || '').replace(' ', 'T'));
      return !Number.isNaN(d.getTime()) && d >= seteDiasAtras;
    }).length;

    const comPse = execucoesFiltradas.filter((e) => Number(e.percepcao_esforco) > 0);
    const pseMedia =
      comPse.length > 0
        ? (
            comPse.reduce((acc, e) => acc + Number(e.percepcao_esforco), 0) / comPse.length
          ).toFixed(1)
        : '—';

    const comDuracao = execucoesFiltradas.filter((e) => Number(e.duracao_minutos) > 0);
    const duracaoMedia =
      comDuracao.length > 0
        ? `${Math.round(
            comDuracao.reduce((acc, e) => acc + Number(e.duracao_minutos), 0) / comDuracao.length
          )} min`
        : '—';

    return { totalSessoes, sessoes7Dias, pseMedia, duracaoMedia };
  }, [execucoesFiltradas]);

  const totalPaginas = Math.max(1, Math.ceil(execucoesFiltradas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const execucoesPaginadas = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return execucoesFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [execucoesFiltradas, paginaSegura]);

  const obterNomeAluno = (exec) => {
    if (exec.aluno_nome) return exec.aluno_nome;
    const encontrado = alunos.find((a) => String(a.id) === String(exec.aluno_id));
    return encontrado ? encontrado.nome || encontrado.name : 'Aluno';
  };

  const obterNomeTreinoFormatado = (exec) => {
    if (exec.modelo_nome) {
      return `${exec.modelo_nome} • ${exec.divisao_nome || 'Divisão'}`;
    }
    if (exec.divisao_nome) return exec.divisao_nome;
    if (exec.treino_divisao) return exec.treino_divisao;
    return 'Treino';
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Acompanhamento de Treinos</h2>
          <p>Histórico imutável de execução, evolução de cargas e frequência dos alunos</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      {erro && (
        <div role="alert" className="treinamento-alerta-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div role="status" className="treinamento-alerta-sucesso">
          {sucesso}
        </div>
      )}

      {/* Filtro por Aluno */}
      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label htmlFor="filtro-aluno-acomp">Filtrar Acompanhamento por Aluno</label>
            <select
              id="filtro-aluno-acomp"
              value={filtroAlunoId}
              onChange={(e) => setFiltroAlunoId(e.target.value)}
            >
              <option value="">Todos os alunos ({execucoes.length} registros)</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome || a.name}
                </option>
              ))}
            </select>
          </div>

          {filtroAlunoId && (
            <div className="treinamento-acoes-linha" style={{ alignItems: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFiltroAlunoId('')}
                className="treinamento-btn treinamento-btn--neutro"
              >
                Limpar filtro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Indicadores Resumo */}
      <div className="treinamento-resumo-grid">
        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">SESSÕES REGISTRADAS</span>
          <div className="treinamento-stat-valor">{indicadores.totalSessoes}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">FREQUÊNCIA (7 DIAS)</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--primario">
            {indicadores.sessoes7Dias} {indicadores.sessoes7Dias === 1 ? 'treino' : 'treinos'}
          </div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">PSE MÉDIA (1 A 10)</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--secundario">
            {indicadores.pseMedia}
          </div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">DURAÇÃO MÉDIA</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--sucesso">
            {indicadores.duracaoMedia}
          </div>
        </div>
      </div>

      {/* Form de Registro de Execução */}
      <div className="form-card">
        <h3 style={{ marginTop: 0 }}>Registrar Execução de Treino</h3>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '-0.25rem', marginBottom: '1.25rem' }}>
          O registro gera um snapshot imutável. Alterações futuras no modelo não alterarão este treino concluído.
        </p>

        <form onSubmit={handleRegistrarExecucao} className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label>Aluno *</label>
            <select
              value={alunoId}
              onChange={(e) => setAlunoId(e.target.value)}
              required
            >
              <option value="">-- Selecione o aluno --</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome || a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="treinamento-campo">
            <label>Modelo e Divisão de Treino *</label>
            <select
              value={opcaoTreinoSelecionada}
              onChange={(e) => handleSelecionarOpcaoTreino(e.target.value)}
              required
              disabled={!alunoId || carregandoModelosAluno}
            >
              <option value="">
                {!alunoId 
                  ? 'Primeiro selecione o aluno' 
                  : carregandoModelosAluno 
                  ? 'Carregando modelos do aluno...' 
                  : '-- Selecione a divisão executada --'}
              </option>

              {/* Modelos de treino atribuídos ao aluno */}
              {modelosDoAluno.length > 0 && (
                <optgroup label="Modelos Compartilhados do Aluno">
                  {modelosDoAluno.map((mod) =>
                    (mod.divisoes || []).map((div) => (
                      <option key={`mod-${mod.id}-div-${div.id}`} value={`modelo:${mod.id}:div:${div.id}`}>
                        {mod.nome} — Divisão: {div.nome} ({div.exercicios?.length || 0} ex)
                      </option>
                    ))
                  )}
                </optgroup>
              )}

              {/* Fichas legadas caso existam */}
              {treinosLegadosDoAluno.length > 0 && (
                <optgroup label="Fichas Personalizadas / Legadas">
                  {treinosLegadosDoAluno.map((t) => (
                    <option key={`leg-${t.id}`} value={`treino:${t.id}`}>
                      {t.divisao || 'Ficha Legada'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {alunoId && !carregandoModelosAluno && modelosDoAluno.length === 0 && treinosLegadosDoAluno.length === 0 && (
              <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '3px' }}>
                Este aluno não possui modelos atribuídos. Acesse a ficha do aluno ou Alunos para atribuir.
              </span>
            )}
          </div>

          <div className="treinamento-campo">
            <label>Duração (min)</label>
            <input
              type="number"
              min="1"
              max="300"
              value={duracaoMinutos}
              onChange={(e) => setDuracaoMinutos(e.target.value)}
            />
          </div>

          <div className="treinamento-campo">
            <label>Esforço Percebido (PSE 1–10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={percepcaoEsforco}
              onChange={(e) => setPercepcaoEsforco(e.target.value)}
            />
          </div>

          {cargasSessao.length > 0 && (
            <div className="treinamento-campo" style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontWeight: 600 }}>Cargas & Desempenho Executados na Sessão</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px', marginTop: '6px' }}>
                {cargasSessao.map((item, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      background: '#f9fafb', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '6px', 
                      padding: '8px 12px' 
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                      {item.nome}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '6px' }}>
                      {item.series && `${item.series} séries`} {item.repeticoes && `• ${item.repeticoes} reps`}
                    </div>
                    <input
                      type="text"
                      placeholder="Carga utilizada (ex: 45kg)"
                      value={item.carga}
                      onChange={(e) => atualizarCargaItem(idx, e.target.value)}
                      style={{ width: '100%', padding: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="treinamento-campo" style={{ gridColumn: '1 / -1' }}>
            <label>Observações da Sessão</label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Desempenho, ajustes, fadiga, técnica..."
            />
          </div>

          <div className="treinamento-acoes-linha" style={{ gridColumn: '1 / -1' }}>
            <button
              type="submit"
              disabled={!podeAcessar(usuarioAtual,'execucoes','criar') || salvando}
              className="treinamento-btn treinamento-btn--escuro"
            >
              {salvando ? 'Salvando Snapshot...' : '💾 Registrar Execução e Gravar Snapshot'}
            </button>
          </div>
        </form>
      </div>

      {/* Gráfico de Evolução de Cargas */}
      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-tabela-header">
          <h3>📈 Evolução de Cargas</h3>
          {nomesExerciciosDisponiveis.length > 0 && (
            <select
              value={exercicioAtivoGrafico}
              onChange={(e) => setExercicioEvolucao(e.target.value)}
              aria-label="Selecionar exercício para evolução de carga"
              style={{ minWidth: '220px' }}
            >
              {nomesExerciciosDisponiveis.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          )}
        </div>

        {dadosEvolucaoCarga.length < 2 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
            {nomesExerciciosDisponiveis.length === 0 
              ? 'Nenhum exercício com carga registrada no filtro atual.'
              : `Registre ao menos 2 execuções com carga numérica para "${exercicioAtivoGrafico}" para gerar a curva.`}
          </div>
        ) : (
          <div className="treinamento-grafico-box" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosEvolucaoCarga}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} unit="kg" />
                <Tooltip />
                <Line type="monotone" dataKey="carga" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} name="Carga (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Histórico Imutável de Execuções */}
      <div className="form-card">
        <div className="treinamento-tabela-header">
          <h3>📋 Histórico de Treinos Executados</h3>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {execucoesFiltradas.length} {execucoesFiltradas.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {carregando ? (
          <div style={{ padding: '1.5rem', textAlign: 'center' }}>Carregando histórico...</div>
        ) : execucoesPaginadas.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
            Nenhuma execução de treino registrada até o momento.
          </div>
        ) : (
          <div className="treinamento-tabela-wrap">
            <table className="treinamento-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aluno</th>
                  <th>Treino Executado</th>
                  <th>Duração / PSE</th>
                  <th>Cargas Registradas</th>
                  <th>Snapshot</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {execucoesPaginadas.map((exec) => (
                  <tr key={exec.id}>
                    <td>{formatarDataCurta(exec.data_execucao)}</td>
                    <td>
                      <strong style={{ color: '#111827' }}>{obterNomeAluno(exec)}</strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{obterNomeTreinoFormatado(exec)}</div>
                      {exec.observacao && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          Obs: {exec.observacao}
                        </div>
                      )}
                    </td>
                    <td>
                      {exec.duracao_minutos ? `${exec.duracao_minutos} min` : '—'}
                      {exec.percepcao_esforco ? ` • PSE ${exec.percepcao_esforco}/10` : ''}
                    </td>
                    <td>
                      {(exec.cargas || []).length > 0 ? (
                        <div style={{ fontSize: '0.8rem', maxWidth: '300px' }}>
                          {(exec.cargas || [])
                            .filter((c) => c.carga)
                            .map((c) => `${c.nome}: ${c.carga}`)
                            .join(' • ') || 'Sem carga informada'}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Sem dados</span>
                      )}
                    </td>
                    <td>
                      {exec.snapshot_treino ? (
                        <button
                          type="button"
                          onClick={() => setSnapshotVisualizar(exec)}
                          className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          title="Ver snapshot imutável gravado no momento da execução"
                        >
                          📸 Ver Snapshot
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Legado</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={!podeAcessar(usuarioAtual,'execucoes','excluir')} onClick={() => handleExcluirExecucao(exec.id)}
                        className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="treinamento-paginacao">
            <span>
              Página {paginaSegura} de {totalPaginas}
            </span>
            <div className="treinamento-acoes-linha">
              <button
                type="button"
                disabled={paginaSegura <= 1}
                onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={paginaSegura >= totalPaginas}
                onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Inspeção do Snapshot Imutável */}
      {snapshotVisualizar && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>📸 Snapshot Imutável de Execução</h3>
              <button 
                type="button" 
                onClick={() => setSnapshotVisualizar(null)} 
                className="btn-icon"
                style={{ fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div><strong>Aluno:</strong> {obterNomeAluno(snapshotVisualizar)}</div>
              <div><strong>Data:</strong> {formatarDataCurta(snapshotVisualizar.data_execucao)}</div>
              <div><strong>Modelo:</strong> {snapshotVisualizar.modelo_nome || snapshotVisualizar.snapshot_treino?.modelo_nome}</div>
              <div><strong>Divisão:</strong> {snapshotVisualizar.divisao_nome || snapshotVisualizar.snapshot_treino?.divisao_nome}</div>
              <div><strong>Duração / Esforço:</strong> {snapshotVisualizar.duracao_minutos} min • PSE {snapshotVisualizar.percepcao_esforco}/10</div>
            </div>

            <h4 style={{ margin: '0.5rem 0' }}>Exercícios Gravados:</h4>
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              <table className="tabela" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Exercício</th>
                    <th>Séries / Reps</th>
                    <th>Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {(snapshotVisualizar.cargas || snapshotVisualizar.snapshot_treino?.exercicios_registrados || []).map((ex, i) => (
                    <tr key={i}>
                      <td><strong>{ex.nome || ex.exercicio_nome}</strong></td>
                      <td>{ex.series ? `${ex.series} x ${ex.repeticoes || '—'}` : '—'}</td>
                      <td><span className="badge badge-info">{ex.carga || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                onClick={() => setSnapshotVisualizar(null)}
                className="btn-salvar"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
