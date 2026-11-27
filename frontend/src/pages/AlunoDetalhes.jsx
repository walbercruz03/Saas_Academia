import CheckinFacial from '../components/CheckinFacial';
import EvolucaoAluno from '../components/EvolucaoAluno';
import HistoricoExecucoesProfessor from '../components/HistoricoExecucoesProfessor';
import GestaoPortalAluno from '../components/GestaoPortalAluno';
import { UserRound, Dumbbell, ClipboardList, CreditCard, ChartLine, History, Smartphone, ArrowLeft, Pencil, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { podeAcessar } from '../permissoesProfessor';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
import '../styles/aluno.css';
import '../styles/treinamento.css';

const parseNumeroCarga = (valor) => {
  if (valor === undefined || valor === null) return null;
  const match = String(valor).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const formatarDataCurta = (dataStr) => {
  if (!dataStr) return '—';
  const d = new Date(String(dataStr).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(dataStr).slice(0, 10);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatarDataContratual = (data) => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(data || '');
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : formatarDataCurta(data);
};

export default function AlunoDetalhes() {
  const { usuario } = useAuth();
  const { id } = useParams();

  const [aluno, setAluno] = useState(null);
  const [modelosAtribuidos, setModelosAtribuidos] = useState([]);
  const [todosModelos, setTodosModelos] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [execucoes, setExecucoes] = useState([]);

  const podeOrientarPortal = usuario?.cargo === 'admin' ||
    (usuario?.cargo === 'professor' && podeAcessar(usuario,'alunos','editar'));
  const [searchParams, setSearchParams] = useSearchParams();
  const abasPermitidas = ['dados', ...(podeAcessar(usuario,'modelos') ? ['treinamento'] : []), ...(podeAcessar(usuario,'matriculas') ? ['matricula'] : []), ...(podeAcessar(usuario,'execucoes') ? ['acompanhamento','historico'] : []), ...(podeOrientarPortal ? ['portal'] : [])];
  const abaSolicitada = searchParams.get('aba');
  const abaAtiva = abasPermitidas.includes(abaSolicitada) ? abaSolicitada : (abasPermitidas.includes('treinamento') ? 'treinamento' : 'dados');
  const setAbaAtiva = (aba) => setSearchParams({ aba }, { replace: true });

  // Modal para atribuir novo modelo
  const [modalAtribuirAberto, setModalAtribuirAberto] = useState(false);
  const [modeloParaAtribuirId, setModeloParaAtribuirId] = useState('');
  const [observacaoAtribuicao, setObservacaoAtribuicao] = useState('');

  // Divisão ativa na visualização de modelos
  const [divisaoAbertaPorModelo, setDivisaoAbertaPorModelo] = useState({});

  // Gráfico de evolução de cargas
  const [exercicioEvolucao, setExercicioEvolucao] = useState('');

  // Estados gerais
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');


  const notificarSucesso = (msg) => {
    setErro('');
    setSucesso(msg);
  };

  const notificarErro = useCallback((msg) => {
    setSucesso('');
    setErro(msg);
  }, []);

  const carregarDadosCompletos = useCallback(async (signal) => {
    setCarregando(true);
    setErro('');
    try {
      const [resAluno, resModelosAluno, resTodosModelos, resMatriculas, resExecucoes] =
        await Promise.all([
          api.get(`/alunos/${id}`, { signal }),
          api.get(`/alunos/${id}/modelos-treino`, { signal }).catch(() => ({ data: [] })),
          api.get('/modelos-treino', { signal, params: { apenas_ativos: 1 } }).catch(() => ({ data: [] })),
          api.get('/matriculas', { signal }).catch(() => ({ data: [] })),
          api.get('/execucoes-treino', { signal, params: { alunoId: id } }).catch(() => ({ data: [] })),
        ]);

      if (signal?.aborted) return;
      setAluno(resAluno.data);
      setModelosAtribuidos(Array.isArray(resModelosAluno.data) ? resModelosAluno.data : []);
      setTodosModelos(Array.isArray(resTodosModelos.data) ? resTodosModelos.data : []);

      const todasMatriculas = Array.isArray(resMatriculas.data) ? resMatriculas.data : [];
      setMatriculas(todasMatriculas.filter((m) => String(m.aluno_id) === String(id)));

      const todasExecucoes = Array.isArray(resExecucoes.data) ? resExecucoes.data : [];
      setExecucoes(todasExecucoes.filter((e) => String(e.aluno_id) === String(id)));
    } catch (err) {
      if (signal?.aborted) return;
      console.error(err);
      notificarErro('Erro ao carregar dados do aluno.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, [id, notificarErro]);

  useEffect(() => {
    const controle = new AbortController();
    carregarDadosCompletos(controle.signal);
    return () => controle.abort();
  }, [carregarDadosCompletos]);

  // Modelos disponíveis que o aluno ainda não possui
  const modelosDisponiveisParaAdicionar = useMemo(() => {
    const atribuidosIds = new Set(modelosAtribuidos.map((m) => Number(m.id || m.modelo_id)));
    return todosModelos.filter((m) => !atribuidosIds.has(Number(m.id)));
  }, [todosModelos, modelosAtribuidos]);

  const handleAtribuirModelo = async (e) => {
    e.preventDefault();
    if (!modeloParaAtribuirId) {
      setErro('Selecione um modelo de treino para atribuir.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await api.post(`/alunos/${id}/modelos-treino`, {
        modelo_id: Number(modeloParaAtribuirId),
        observacoes: observacaoAtribuicao.trim() || null,
      });

      notificarSucesso('Modelo de treino atribuído com sucesso ao aluno!');
      setModalAtribuirAberto(false);
      setModeloParaAtribuirId('');
      setObservacaoAtribuicao('');
      await carregarDadosCompletos();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao atribuir modelo ao aluno.');
    } finally {
      setSalvando(false);
    }
  };

  const handleDesassociarModelo = async (modelo) => {
    const nomeMod = modelo.nome || modelo.modelo_nome || 'este modelo';
    if (
      !window.confirm(
        `Deseja realmente remover o vínculo do modelo "${nomeMod}" deste aluno?\n\nNota: Isso removerá apenas a atribuição deste aluno. O modelo continuará intacto para outros alunos da academia.`
      )
    ) {
      return;
    }

    setErro('');
    setSucesso('');
    try {
      await api.delete(`/alunos/${id}/modelos-treino/${modelo.id || modelo.modelo_id}`);
      notificarSucesso(`Vínculo com "${nomeMod}" removido com sucesso.`);
      await carregarDadosCompletos();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao desvincular modelo.');
    }
  };

  // Exercícios para gráfico de evolução de cargas
  const nomesExerciciosExecutados = useMemo(() => {
    const setNomes = new Set();
    execucoes.forEach((ex) => {
      (ex.cargas || []).forEach((c) => {
        if (c.nome) setNomes.add(c.nome);
      });
    });
    return Array.from(setNomes).sort((a, b) => a.localeCompare(b));
  }, [execucoes]);

  const exercicioAtivoGrafico = useMemo(() => {
    if (exercicioEvolucao && nomesExerciciosExecutados.includes(exercicioEvolucao)) {
      return exercicioEvolucao;
    }
    return nomesExerciciosExecutados[0] || '';
  }, [exercicioEvolucao, nomesExerciciosExecutados]);

  const dadosGraficoCarga = useMemo(() => {
    if (!exercicioAtivoGrafico) return [];
    const ordenadas = [...execucoes].sort(
      (a, b) => new Date(a.data_execucao || 0) - new Date(b.data_execucao || 0)
    );

    const pontos = [];
    ordenadas.forEach((exec) => {
      const match = (exec.cargas || []).find(
        (c) => String(c.nome || '').toLowerCase() === exercicioAtivoGrafico.toLowerCase()
      );
      if (!match) return;
      const num = parseNumeroCarga(match.carga);
      if (num === null) return;
      pontos.push({
        data: formatarDataCurta(exec.data_execucao),
        carga: num,
        rotulo: match.carga,
      });
    });
    return pontos;
  }, [execucoes, exercicioAtivoGrafico]);

  if (carregando) {
    return (
      <div className="page-container">
        <div className="form-card">Carregando dados detalhados do aluno...</div>
      </div>
    );
  }

  if (!aluno) {
    return (
      <div className="page-container">
        <div className="form-card">
          <p>Aluno não encontrado.</p>
          <Link to="/alunos" className="treinamento-btn treinamento-btn--escuro">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para lista de alunos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container treinamento-page aluno-detalhes-page">
      {/* Cabeçalho do Aluno */}
      <div className="page-header aluno-perfil-header">
        <div className="aluno-perfil-identidade">
          <span className="aluno-perfil-avatar"><UserRound size={30} aria-hidden="true" /></span>
          <div className="aluno-perfil-texto">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2>{aluno.nome}</h2>
            <span
              className={`badge badge-${aluno.status}`}
              style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}
            >
              {aluno.status}
            </span>
          </div>
          <p>
            CPF: {aluno.cpf || 'Não informado'}{aluno.cpf_invalido && ' (inválido)'} • Telefone: {aluno.telefone || 'Não informado'} • E-mail:{' '}
            {aluno.email || 'Não informado'}
          </p>
          </div>
        </div>
        <div className="treinamento-acoes-header">
          <Link to="/alunos" className="treinamento-btn treinamento-btn--neutro">
            <ArrowLeft size={16} aria-hidden="true" /> Todos os Alunos
          </Link>
        </div>
      </div>

      {erro && !modalAtribuirAberto && (
        <div role="alert" className="treinamento-alerta-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div role="status" className="treinamento-alerta-sucesso">
          {sucesso}
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="form-card aluno-abas-card">
        <div className="aluno-abas" role="group" aria-label="Seções do aluno">
          <button
            type="button"
            aria-pressed={abaAtiva === 'treinamento'} onClick={() => setAbaAtiva('treinamento')} disabled={!podeAcessar(usuario,'modelos')}
            className={`treinamento-btn ${
              abaAtiva === 'treinamento' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            <Dumbbell size={16} aria-hidden="true" /> Treinamento ({modelosAtribuidos.length} modelos)
          </button>
          <button
            type="button"
            aria-pressed={abaAtiva === 'dados'} onClick={() => setAbaAtiva('dados')}
            className={`treinamento-btn ${
              abaAtiva === 'dados' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            <ClipboardList size={16} aria-hidden="true" /> Dados Pessoais
          </button>
          <button
            type="button"
            aria-pressed={abaAtiva === 'matricula'} onClick={() => setAbaAtiva('matricula')} disabled={!podeAcessar(usuario,'matriculas')}
            className={`treinamento-btn ${
              abaAtiva === 'matricula' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            <CreditCard size={16} aria-hidden="true" /> Matrícula & Planos ({matriculas.length})
          </button>
          <button
            type="button"
            aria-pressed={abaAtiva === 'acompanhamento'} onClick={() => setAbaAtiva('acompanhamento')} disabled={!podeAcessar(usuario,'execucoes')}
            className={`treinamento-btn ${
              abaAtiva === 'acompanhamento' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            <ChartLine size={16} aria-hidden="true" /> Acompanhamento ({execucoes.length} sessões)
          </button>
          <button
            type="button"
            aria-pressed={abaAtiva === 'historico'} onClick={() => setAbaAtiva('historico')} disabled={!podeAcessar(usuario,'execucoes')}
            className={`treinamento-btn ${
              abaAtiva === 'historico' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            <History size={16} aria-hidden="true" /> Histórico Imutável
          </button>
          {podeOrientarPortal && <button type="button" onClick={() => setAbaAtiva('portal')}
            aria-pressed={abaAtiva === 'portal'}
            className={`treinamento-btn ${abaAtiva === 'portal' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'}`}>
            <Smartphone size={16} aria-hidden="true" /> Portal do Aluno
          </button>}
        </div>

      </div>
      {abaAtiva === 'portal' && podeOrientarPortal && (
        <GestaoPortalAluno key={id} id={id} administrador={usuario?.cargo === 'admin'} />
      )}

      {/* ABA: TREINAMENTO */}
      {abaAtiva === 'treinamento' && podeAcessar(usuario,'modelos') && (
        <div>
          <div className="treinamento-tabela-header" style={{ marginBottom: '1rem' }}>
            <div>
              <h3>Modelos de Treinamento Atribuídos</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                Estes modelos são compartilhados: qualquer edição no modelo original refletirá automaticamente para o aluno.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setModeloParaAtribuirId(modelosDisponiveisParaAdicionar[0]?.id || '');
                setObservacaoAtribuicao('');
                setErro('');
                setModalAtribuirAberto(true);
              }}
              className="treinamento-btn treinamento-btn--primario"
            >
              <Plus size={16} aria-hidden="true" /> Atribuir Modelo ao Aluno
            </button>
          </div>

          {modelosAtribuidos.length === 0 ? (
            <div className="form-card">
              <p style={{ color: '#6b7280' }}>
                Este aluno ainda não possui nenhum modelo de treino atribuído.
              </p>
              <button
                type="button"
                onClick={() => {
                  setModeloParaAtribuirId(modelosDisponiveisParaAdicionar[0]?.id || '');
                  setModalAtribuirAberto(true);
                }}
                className="treinamento-btn treinamento-btn--primario"
              >
                Atribuir Primeiro Modelo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {modelosAtribuidos.map((modelo) => {
                const divisoes = Array.isArray(modelo.divisoes) ? modelo.divisoes : [];
                const divisaoSelecionadaIdx = divisaoAbertaPorModelo[modelo.id] || 0;
                const divisaoExibida = divisoes[divisaoSelecionadaIdx] || divisoes[0];

                return (
                  <div key={modelo.id || modelo.vinculo_id} className="form-card">
                    <div className="treinamento-tabela-header">
                      <div>
                        <h3 style={{ margin: 0 }}>{modelo.nome}</h3>
                        <div style={{ marginTop: '0.25rem' }}>
                          {modelo.modalidade_nome && (
                            <span className="treinamento-badge treinamento-badge--azul" style={{ marginRight: '0.5rem' }}>
                              {modelo.modalidade_nome}
                            </span>
                          )}
                          <span className="treinamento-badge treinamento-badge--neutro" style={{ marginRight: '0.5rem' }}>
                            {modelo.nivel_nome || modelo.nivel || 'Intermediário'}
                          </span>
                          <span className="treinamento-badge treinamento-badge--sucesso">
                            {divisoes.length} {divisoes.length === 1 ? 'divisão' : 'divisões'}
                          </span>
                        </div>
                      </div>

                      <div className="treinamento-acoes-linha">
                        <Link
                          to="/treinos/modelos"
                          className="treinamento-btn treinamento-btn--suave-azul treinamento-btn--sm"
                          title="Edita o modelo compartilhado original (afeta todos os alunos vinculados)"
                        >
                          <Pencil size={16} aria-hidden="true" /> Editar Modelo Global
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDesassociarModelo(modelo)}
                          className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                        >
                          Remover deste Aluno
                        </button>
                      </div>
                    </div>

                    {modelo.descricao && (
                      <p style={{ color: '#4b5563', margin: '0.5rem 0' }}>{modelo.descricao}</p>
                    )}

                    {modelo.objetivo && (
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0.75rem 0' }}>
                        <strong>Objetivo:</strong> {modelo.objetivo}
                      </p>
                    )}

                    {/* Divisões em abas horizontais */}
                    {divisoes.length > 0 && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            marginBottom: '1rem',
                          }}
                        >
                          {divisoes.map((d, dIdx) => (
                            <button
                              key={d.id || dIdx}
                              type="button"
                              onClick={() =>
                                setDivisaoAbertaPorModelo({
                                  ...divisaoAbertaPorModelo,
                                  [modelo.id]: dIdx,
                                })
                              }
                              className={`treinamento-btn ${
                                divisaoSelecionadaIdx === dIdx
                                  ? 'treinamento-btn--escuro'
                                  : 'treinamento-btn--neutro'
                              } treinamento-btn--sm`}
                            >
                              {d.nome} ({(d.exercicios || []).length} ex.)
                            </button>
                          ))}
                        </div>

                        {divisaoExibida && (
                          <div>
                            {divisaoExibida.descricao && (
                              <p style={{ fontStyle: 'italic', color: '#6b7280', marginBottom: '0.75rem' }}>
                                {divisaoExibida.descricao}
                              </p>
                            )}

                            <div className="treinamento-preview-lista">
                              {(!divisaoExibida.exercicios || divisaoExibida.exercicios.length === 0) ? (
                                <p style={{ color: '#6b7280' }}>Nenhum exercício nesta divisão.</p>
                              ) : (
                                divisaoExibida.exercicios.map((ex, exIdx) => (
                                  <div key={ex.id || exIdx} className="treinamento-preview-item">
                                    <div>
                                      <strong>
                                        {exIdx + 1}. {ex.nome}
                                      </strong>{' '}
                                      — {ex.series || '3'}x{ex.repeticoes || '12'}
                                      {ex.carga ? ` • Carga Sugerida: ${ex.carga}` : ''}
                                      {ex.descanso ? ` • Descanso: ${ex.descanso}` : ''}
                                    </div>
                                    {ex.observacao && (
                                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                        Obs: {ex.observacao}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA: DADOS PESSOAIS */}
      {abaAtiva === 'dados' && usuario?.cargo === 'admin' &&
        <CheckinFacial key={id} administrador aluno={Number(id)} />}

      {abaAtiva === 'dados' && (
        <div className="form-card">
          <h3>Ficha Cadastral do Aluno</h3>
          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <div className="campo">
              <label>Nome Completo</label>
              <input type="text" value={aluno.nome} readOnly />
            </div>
            <div className="campo">
              <label>CPF</label>
              <input type="text" value={aluno.cpf || 'Não cadastrado'} readOnly />
              {aluno.cpf_invalido && <p>CPF inválido. Regularize na edição do aluno.</p>}
            </div>
            <div className="campo">
              <label>Telefone / WhatsApp</label>
              <input type="text" value={aluno.telefone || 'Não cadastrado'} readOnly />
            </div>
            <div className="campo">
              <label>E-mail</label>
              <input type="text" value={aluno.email || 'Não cadastrado'} readOnly />
            </div>
            <div className="campo">
              <label>Data de Nascimento</label>
              <input type="text" value={aluno.data_nascimento || 'Não informada'} readOnly />
            </div>
            <div className="campo">
              <label>Status</label>
              <input type="text" value={aluno.status} readOnly />
            </div>
            <div className="campo-full">
              <label>Contato de Emergência</label>
              <input type="text" value={(podeAcessar(usuario,'saude') && aluno.contato_emergencia) || 'Nenhum contato registrado'} readOnly />
            </div>
            <div className="campo-full">
              <label>Anamnese / Histórico de Saúde</label>
              <textarea rows={3} value={(podeAcessar(usuario,'saude') && aluno.anamnese) || 'Nenhuma observação registrada'} readOnly />
            </div>
          </div>
          <div className="treinamento-acoes-linha" style={{ marginTop: '1.5rem' }}>
            <Link to="/alunos" className="treinamento-btn treinamento-btn--escuro">
              Editar Dados no Cadastro de Alunos →
            </Link>
          </div>
        </div>
      )}

      {/* ABA: MATRÍCULA */}
      {abaAtiva === 'matricula' && podeAcessar(usuario,'matriculas') && (
        <div className="form-card">
          <div className="treinamento-tabela-header">
            <h3>Situação de Matrícula e Planos</h3>
            <Link to="/matriculas" className="treinamento-btn treinamento-btn--primario treinamento-btn--sm">
              Gerenciar Matrículas →
            </Link>
          </div>

          {matriculas.length === 0 ? (
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>
              Nenhuma matrícula ativa registrada para este aluno.
            </p>
          ) : (
            <div className="treinamento-tabela-wrap" style={{ marginTop: '1rem' }}>
              <table className="treinamento-tabela">
                <thead>
                  <tr>
                    <th>Plano</th>
                    <th>Valor</th>
                    <th>Início</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matriculas.map((mat) => (
                    <tr key={mat.id}>
                      <td>
                        <strong>{mat.plano_nome || 'Plano Padrão'}</strong>
                      </td>
                      <td>R$ {Number(mat.valor_pago || 0).toFixed(2)}</td>
                      <td>{formatarDataContratual(mat.data_inicio)}</td>
                      <td>{formatarDataContratual(mat.data_vencimento)}</td>
                      <td>
                        <span
                          className={`badge ${
                            mat.situacao_efetiva === 'vigente' ? 'badge-ativo' : 'badge-inativo'
                          }`}
                        >
                          {(mat.situacao_efetiva || mat.status || '—').replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA: ACOMPANHAMENTO */}
      {abaAtiva === 'acompanhamento' && podeAcessar(usuario,'execucoes') && (
        <div>
          <div className="treinamento-resumo-grid">
            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">TOTAL DE SESSÕES</span>
              <div className="treinamento-stat-valor">{execucoes.length}</div>
            </div>

            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">MODELOS EM USO</span>
              <div className="treinamento-stat-valor treinamento-stat-valor--primario">
                {modelosAtribuidos.length}
              </div>
            </div>

            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">PSE MÉDIA</span>
              <div className="treinamento-stat-valor treinamento-stat-valor--secundario">
                {execucoes.filter((e) => Number(e.percepcao_esforco) > 0).length > 0
                  ? (
                      execucoes.reduce((acc, e) => acc + Number(e.percepcao_esforco || 0), 0) /
                      execucoes.filter((e) => Number(e.percepcao_esforco) > 0).length
                    ).toFixed(1)
                  : '—'}
              </div>
            </div>
          </div>

          {/* Gráfico de Evolução de Carga do Aluno */}
          <div className="form-card" style={{ marginTop: '1.25rem' }}>
            <div className="treinamento-tabela-header">
              <h3>Evolução de Cargas do Aluno</h3>
              {nomesExerciciosExecutados.length > 0 && (
                <select
                  value={exercicioAtivoGrafico}
                  onChange={(e) => setExercicioEvolucao(e.target.value)}
                  aria-label="Selecionar exercício para evolução"
                >
                  {nomesExerciciosExecutados.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {dadosGraficoCarga.length < 2 ? (
              <p style={{ color: '#6b7280', marginTop: '1rem' }}>
                Registre pelo menos 2 execuções com carga numérica para este exercício para visualizar a evolução gráfica.
              </p>
            ) : (
              <div className="treinamento-grafico-box" style={{ marginTop: '1rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGraficoCarga}>
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
        </div>
      )}

      {/* ABA: HISTÓRICO IMUTÁVEL */}
      {abaAtiva === 'historico' && podeAcessar(usuario,'execucoes') && (
        <div className="form-card"><EvolucaoAluno key={id} aluno={id} /></div>
      )}

      {abaAtiva === 'historico' && podeAcessar(usuario,'execucoes') && (
        <HistoricoExecucoesProfessor key={id} aluno={id} />
      )}

      {abaAtiva === 'historico' && podeAcessar(usuario,'execucoes') && (
        <div className="form-card">
          <div className="treinamento-tabela-header">
            <h3>Histórico Imutável de Execuções</h3>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              Registros preservados no momento da execução, imunes a alterações futuras nos modelos
            </span>
          </div>

          {execucoes.length === 0 ? (
            <p style={{ color: '#6b7280', marginTop: '1rem' }}>
              Nenhuma execução de treino registrada para este aluno até o momento.
            </p>
          ) : (
            <div className="treinamento-tabela-wrap" style={{ marginTop: '1rem' }}>
              <table className="treinamento-tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Modelo / Treino Executado</th>
                    <th>Duração / Esforço</th>
                    <th>Cargas Utilizadas</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {execucoes.map((exec) => (
                    <tr key={exec.id}>
                      <td>
                        <strong>{formatarDataCurta(exec.data_execucao)}</strong>
                      </td>
                      <td>
                        <div>
                          <strong>{exec.modelo_nome || exec.treino_divisao || 'Treino'}</strong>
                          {exec.divisao_nome && <span> — {exec.divisao_nome}</span>}
                        </div>
                      </td>
                      <td>
                        {exec.duracao_minutos ? `${exec.duracao_minutos} min` : '—'}
                        {exec.percepcao_esforco ? ` • PSE ${exec.percepcao_esforco}/10` : ''}
                      </td>
                      <td>
                        {(exec.cargas || []).length > 0 ? (
                          <div>
                            {(exec.cargas || [])
                              .filter((c) => c.carga)
                              .map((c) => `${c.nome}: ${c.carga}`)
                              .join(' • ') || '—'}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{exec.observacao || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: ATRIBUIR NOVO MODELO AO ALUNO */}
      {modalAtribuirAberto && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card treinamento-modal-card--sm">
            <div className="treinamento-modal-header">
              <h3>Atribuir Modelo de Treino a {aluno.nome}</h3>
              <button
                type="button"
                onClick={() => setModalAtribuirAberto(false)}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            {modelosDisponiveisParaAdicionar.length === 0 ? (
              <div style={{ padding: '1rem 0' }}>
                <p>Todos os modelos de treino ativos já estão atribuídos a este aluno.</p>
                <div className="treinamento-modal-footer">
                  <button
                    type="button"
                    onClick={() => setModalAtribuirAberto(false)}
                    className="treinamento-btn treinamento-btn--neutro"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAtribuirModelo} className="treinamento-grid-auto">
                <div className="treinamento-campo">
                  <label htmlFor="select-mod-aluno">Selecione o Modelo de Treino *</label>
                  <select
                    id="select-mod-aluno"
                    value={modeloParaAtribuirId}
                    onChange={(e) => setModeloParaAtribuirId(e.target.value)}
                    required
                  >
                    <option value="">-- Escolha um modelo --</option>
                    {modelosDisponiveisParaAdicionar.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome} ({m.modalidade_nome ? `${m.modalidade_nome} • ` : ''}
                        {m.nivel_nome || m.nivel || 'Intermediário'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="treinamento-campo">
                  <label htmlFor="obs-atrib">Observações para o Aluno (opcional)</label>
                  <input
                    id="obs-atrib"
                    type="text"
                    value={observacaoAtribuicao}
                    onChange={(e) => setObservacaoAtribuicao(e.target.value)}
                    placeholder="Ex: Seguir este treino por 6 semanas, foco em adaptação..."
                  />
                </div>

                <div className="treinamento-modal-footer">
                  <button
                    type="button"
                    onClick={() => setModalAtribuirAberto(false)}
                    className="treinamento-btn treinamento-btn--neutro"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="treinamento-btn treinamento-btn--escuro"
                  >
                    {salvando ? 'Atribuindo...' : 'Confirmar Atribuição'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
