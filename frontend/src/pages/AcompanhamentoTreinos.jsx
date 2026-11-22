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

const ITENS_POR_PAGINA = 6;

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
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

export default function AcompanhamentoTreinos() {
  const [execucoes, setExecucoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [treinos, setTreinos] = useState([]);

  const [filtroAlunoId, setFiltroAlunoId] = useState('');
  const [exercicioEvolucao, setExercicioEvolucao] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [alunoId, setAlunoId] = useState('');
  const [treinoId, setTreinoId] = useState('');
  const [duracaoMinutos, setDuracaoMinutos] = useState('50');
  const [percepcaoEsforco, setPercepcaoEsforco] = useState('7');
  const [observacao, setObservacao] = useState('');
  const [cargasSessao, setCargasSessao] = useState([]);

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

  const treinosDoAluno = useMemo(() => {
    if (!alunoId) return treinos;
    return treinos.filter((t) => String(t.aluno_id ?? t.alunoId) === String(alunoId));
  }, [treinos, alunoId]);

  const handleSelecionarTreino = (novoTreinoId) => {
    setTreinoId(novoTreinoId);
    const ficha = treinos.find((t) => String(t.id) === String(novoTreinoId));
    if (!ficha) {
      setCargasSessao([]);
      return;
    }

    if (!alunoId && (ficha.aluno_id ?? ficha.alunoId)) {
      setAlunoId(String(ficha.aluno_id ?? ficha.alunoId));
    }

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

    if (!alunoId || !treinoId) {
      setErro('Selecione o aluno e a ficha de treino executada.');
      return;
    }

    setSalvando(true);
    try {
      await api.post('/execucoes-treino', {
        aluno_id: Number(alunoId),
        treino_id: Number(treinoId),
        duracao_minutos: duracaoMinutos ? Number(duracaoMinutos) : null,
        percepcao_esforco: percepcaoEsforco ? Number(percepcaoEsforco) : null,
        observacao: observacao.trim() || null,
        cargas: cargasSessao,
      });

      setSucesso('Execução de treino registrada com sucesso!');
      setTreinoId('');
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

  const obterNomeTreino = (exec) => {
    if (exec.treino_divisao) return exec.treino_divisao;
    const encontrado = treinos.find((t) => String(t.id) === String(exec.treino_id));
    return encontrado ? encontrado.divisao : 'Ficha de Treino';
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Acompanhamento de Treinos</h2>
          <p>Histórico de execução, frequência, evolução de cargas e desempenho dos alunos</p>
        </div>
        <Link to="/dashboard">← Voltar</Link>
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

      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label htmlFor="filtro-aluno-acomp">Filtrar Acompanhamento por Aluno</label>
            <select
              id="filtro-aluno-acomp"
              value={filtroAlunoId}
              onChange={(e) => setFiltroAlunoId(e.target.value)}
            >
              <option value="">Todos os alunos</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome || a.name}
                </option>
              ))}
            </select>
          </div>

          {filtroAlunoId && (
            <div className="treinamento-acoes-linha">
              <button
                type="button"
                onClick={() => setFiltroAlunoId('')}
                className="treinamento-btn treinamento-btn--neutro"
              >
                Ver todos os alunos
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="treinamento-resumo-grid">
        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">SESSÕES REGISTRADAS</span>
          <div className="treinamento-stat-valor">{indicadores.totalSessoes}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">FREQUÊNCIA (ÚLTIMOS 7 DIAS)</span>
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

      <div className="form-card treinamento-filtro-card">
        <h3>Registrar Execução de Treino</h3>

        <form onSubmit={handleRegistrarExecucao} className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label>Aluno *</label>
            <select
              value={alunoId}
              onChange={(e) => {
                setAlunoId(e.target.value);
                setTreinoId('');
                setCargasSessao([]);
              }}
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
            <label>Ficha de Treino *</label>
            <select
              value={treinoId}
              onChange={(e) => handleSelecionarTreino(e.target.value)}
              required
            >
              <option value="">-- Selecione a ficha --</option>
              {treinosDoAluno.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.divisao}
                </option>
              ))}
            </select>
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
            <div className="treinamento-campo">
              <label>Cargas Executadas na Sessão</label>
              <div className="treinamento-item-campos">
                {cargasSessao.map((item, idx) => (
                  <div key={idx} className="treinamento-item-box">
                    <div>
                      <strong>{item.nome}</strong>
                    </div>
                    <input
                      type="text"
                      placeholder="Carga (ex: 40kg)"
                      value={item.carga}
                      onChange={(e) => atualizarCargaItem(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="treinamento-campo">
            <label>Observações da Sessão</label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Desempenho, amplitude, fadiga, ajustes..."
            />
          </div>

          <div className="treinamento-acoes-linha">
            <button
              type="submit"
              disabled={salvando}
              className="treinamento-btn treinamento-btn--escuro"
            >
              {salvando ? 'Salvando...' : 'Salvar Execução'}
            </button>
          </div>
        </form>
      </div>

      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-tabela-header">
          <h3>Evolução de Cargas</h3>
          {nomesExerciciosDisponiveis.length > 0 && (
            <select
              value={exercicioAtivoGrafico}
              onChange={(e) => setExercicioEvolucao(e.target.value)}
              aria-label="Selecionar exercício para evolução de carga"
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
          <div>
            Registre ao menos 2 execuções com carga numérica para visualizar a curva de evolução.
          </div>
        ) : (
          <div className="treinamento-grafico-box">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosEvolucaoCarga}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="carga" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="form-card">
        <div className="treinamento-tabela-header">
          <h3>Histórico de Execuções</h3>
          <span>
            {execucoesFiltradas.length} {execucoesFiltradas.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {carregando ? (
          <div>Carregando histórico...</div>
        ) : execucoesPaginadas.length === 0 ? (
          <div>Nenhuma execução de treino registrada até o momento.</div>
        ) : (
          <div className="treinamento-tabela-wrap">
            <table className="treinamento-tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Aluno</th>
                  <th>Treino</th>
                  <th>Duração / PSE</th>
                  <th>Cargas & Obs</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {execucoesPaginadas.map((exec) => (
                  <tr key={exec.id}>
                    <td>{formatarDataCurta(exec.data_execucao)}</td>
                    <td>
                      <strong>{obterNomeAluno(exec)}</strong>
                    </td>
                    <td>{obterNomeTreino(exec)}</td>
                    <td>
                      {exec.duracao_minutos ? `${exec.duracao_minutos} min` : '—'}
                      {exec.percepcao_esforco ? ` • PSE ${exec.percepcao_esforco}/10` : ''}
                    </td>
                    <td>
                      {(exec.cargas || []).length > 0 && (
                        <div>
                          {(exec.cargas || [])
                            .filter((c) => c.carga)
                            .map((c) => `${c.nome}: ${c.carga}`)
                            .join(' • ') || 'Cargas não informadas'}
                        </div>
                      )}
                      {exec.observacao && <div>Obs: {exec.observacao}</div>}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleExcluirExecucao(exec.id)}
                        className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
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
    </div>
  );
}