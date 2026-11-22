import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/treinamento.css';

const ITENS_POR_PAGINA = 6;

const NIVEL_LABEL = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

const criarItemExercicio = (ordem = 1, base = {}) => ({
  exercicio_id: base.exercicio_id ? String(base.exercicio_id) : '',
  ordem,
  series: base.series || '3',
  repeticoes: base.repeticoes || '12',
  carga: base.carga || '',
  descanso: base.descanso || '60s',
  observacao: base.observacao || '',
});

const estadoInicialForm = {
  nome: '',
  divisao: 'Treino A',
  nivel: 'intermediario',
  descricao: '',
  ativo: true,
  exercicios: [criarItemExercicio(1)],
};

export default function ModelosTreino() {
  const navigate = useNavigate();

  const [modelos, setModelos] = useState([]);
  const [exerciciosCatalogo, setExerciciosCatalogo] = useState([]);
  const [alunos, setAlunos] = useState([]);

  const [busca, setBusca] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoModelo, setEditandoModelo] = useState(null);
  const [form, setForm] = useState(estadoInicialForm);

  const [modeloReutilizar, setModeloReutilizar] = useState(null);
  const [alunoReutilizarId, setAlunoReutilizarId] = useState('');
  const [divisaoReutilizar, setDivisaoReutilizar] = useState('');
  const [reutilizando, setReutilizando] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroNivel]);

  const notificarSucesso = (msg) => {
    setErro('');
    setSucesso(msg);
  };

  const notificarErro = (msg) => {
    setSucesso('');
    setErro(msg);
  };

  const carregarDados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [resModelos, resExercicios, resAlunos] = await Promise.all([
        api.get('/modelos-treino').catch(() => ({ data: [] })),
        api.get('/exercicios').catch(() => ({ data: [] })),
        api.get('/alunos').catch(() => ({ data: [] })),
      ]);

      const listaModelos = Array.isArray(resModelos.data)
        ? resModelos.data
        : resModelos.data?.modelos || [];
      const listaExercicios = Array.isArray(resExercicios.data)
        ? resExercicios.data
        : resExercicios.data?.exercicios || [];
      const listaAlunos = Array.isArray(resAlunos.data)
        ? resAlunos.data
        : resAlunos.data?.alunos || [];

      setModelos(listaModelos);
      setExerciciosCatalogo(listaExercicios);
      setAlunos(listaAlunos);
    } catch (err) {
      console.error(err);
      notificarErro('Erro ao carregar modelos de treino.');
    } finally {
      setCarregando(false);
    }
  };

  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const matchNome = String(m.nome || '').toLowerCase().includes(termo);
        const matchDesc = String(m.descricao || '').toLowerCase().includes(termo);
        const matchDiv = String(m.divisao || '').toLowerCase().includes(termo);
        if (!matchNome && !matchDesc && !matchDiv) return false;
      }

      if (filtroNivel && String(m.nivel || '').toLowerCase() !== filtroNivel) {
        return false;
      }

      return true;
    });
  }, [modelos, busca, filtroNivel]);

  const totalPaginas = Math.max(1, Math.ceil(modelosFiltrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const modelosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return modelosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [modelosFiltrados, paginaSegura]);

  const resumo = useMemo(() => {
    const total = modelos.length;
    const ativos = modelos.filter((m) => m.ativo !== 0 && m.ativo !== false).length;
    const totalItens = modelos.reduce(
      (acc, m) => acc + (Array.isArray(m.exercicios) ? m.exercicios.length : 0),
      0
    );
    return { total, ativos, totalItens };
  }, [modelos]);

  const reordenarItens = (lista) =>
    lista.map((item, idx) => ({
      ...item,
      ordem: idx + 1,
    }));

  const adicionarExercicioAoForm = () => {
    setForm((prev) => ({
      ...prev,
      exercicios: [...prev.exercicios, criarItemExercicio(prev.exercicios.length + 1)],
    }));
  };

  const atualizarItemExercicio = (index, campo, valor) => {
    setForm((prev) => {
      const proximos = [...prev.exercicios];
      proximos[index] = { ...proximos[index], [campo]: valor };
      return { ...prev, exercicios: proximos };
    });
  };

  const moverItemExercicio = (index, direcao) => {
    const destino = index + direcao;
    setForm((prev) => {
      if (destino < 0 || destino >= prev.exercicios.length) return prev;
      const copia = [...prev.exercicios];
      const [removido] = copia.splice(index, 1);
      copia.splice(destino, 0, removido);
      return { ...prev, exercicios: reordenarItens(copia) };
    });
  };

  const removerItemExercicio = (index) => {
    setForm((prev) => {
      if (prev.exercicios.length <= 1) return prev;
      const filtrados = prev.exercicios.filter((_, idx) => idx !== index);
      return { ...prev, exercicios: reordenarItens(filtrados) };
    });
  };

  const abrirNovoModal = () => {
    setEditandoModelo(null);
    setForm(estadoInicialForm);
    setErro('');
    setModalAberto(true);
  };

  const abrirEditarModal = (modelo) => {
    setEditandoModelo(modelo);
    const itens =
      Array.isArray(modelo.exercicios) && modelo.exercicios.length > 0
        ? reordenarItens(
            modelo.exercicios.map((ex, idx) =>
              criarItemExercicio(idx + 1, {
                exercicio_id: ex.exercicio_id,
                series: ex.series,
                repeticoes: ex.repeticoes,
                carga: ex.carga,
                descanso: ex.descanso,
                observacao: ex.observacao,
              })
            )
          )
        : [criarItemExercicio(1)];

    setForm({
      nome: modelo.nome || '',
      divisao: modelo.divisao || 'Treino A',
      nivel: modelo.nivel || 'intermediario',
      descricao: modelo.descricao || '',
      ativo: modelo.ativo !== 0 && modelo.ativo !== false,
      exercicios: itens,
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setEditandoModelo(null);
    setForm(estadoInicialForm);
  };

  const handleSalvarModelo = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do modelo de treino.');
      return;
    }

    const itensLimpos = form.exercicios
      .filter((item) => Boolean(item.exercicio_id))
      .map((item, idx) => ({
        exercicio_id: Number(item.exercicio_id),
        ordem: idx + 1,
        series: String(item.series || '3').trim(),
        repeticoes: String(item.repeticoes || '12').trim(),
        carga: item.carga ? String(item.carga).trim() : null,
        descanso: item.descanso ? String(item.descanso).trim() : null,
        observacao: item.observacao ? String(item.observacao).trim() : null,
      }));

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: form.nome.trim(),
        divisao: form.divisao.trim() || 'Treino A',
        nivel: form.nivel,
        descricao: form.descricao.trim() || null,
        ativo: form.ativo ? 1 : 0,
        exercicios: itensLimpos,
      };

      if (editandoModelo) {
        await api.put(`/modelos-treino/${editandoModelo.id}`, payload);
        notificarSucesso('Modelo de treino atualizado com sucesso!');
      } else {
        await api.post('/modelos-treino', payload);
        notificarSucesso('Modelo de treino criado com sucesso!');
      }

      setModalAberto(false);
      setEditandoModelo(null);
      setForm(estadoInicialForm);
      await carregarDados();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao salvar modelo de treino.');
    } finally {
      setSalvando(false);
    }
  };

  const handleDuplicarModelo = async (modelo) => {
    setErro('');
    setSucesso('');
    try {
      await api.post(`/modelos-treino/${modelo.id}/duplicar`, {
        nome: `${modelo.nome} (Cópia)`,
      });
      notificarSucesso(`Modelo "${modelo.nome}" duplicado com sucesso!`);
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao duplicar modelo de treino.');
    }
  };

  const handleExcluirModelo = async (modelo) => {
    if (!window.confirm(`Deseja realmente excluir o modelo "${modelo.nome}"?`)) return;
    setErro('');
    setSucesso('');
    try {
      await api.delete(`/modelos-treino/${modelo.id}`);
      notificarSucesso('Modelo de treino excluído com sucesso!');
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao excluir modelo de treino.');
    }
  };

  const abrirModalReutilizar = (modelo) => {
    setModeloReutilizar(modelo);
    setAlunoReutilizarId('');
    setDivisaoReutilizar(modelo.divisao || modelo.nome || 'Treino A');
    setErro('');
  };

  const handleReutilizarParaAluno = async (e) => {
    e.preventDefault();
    if (!modeloReutilizar || !alunoReutilizarId) {
      setErro('Selecione um aluno para aplicar este modelo.');
      return;
    }

    setReutilizando(true);
    setErro('');
    setSucesso('');

    try {
      const exerciciosFormatados = (modeloReutilizar.exercicios || []).map((ex, idx) => ({
        exercicio_id: ex.exercicio_id,
        nome: ex.nome,
        ordem: idx + 1,
        series: ex.series,
        repeticoes: ex.repeticoes,
        carga: ex.carga || '',
        descanso: ex.descanso || '',
        observacao: ex.observacao || '',
      }));

      await api.post('/treinos', {
        aluno_id: alunoReutilizarId,
        divisao: divisaoReutilizar.trim() || modeloReutilizar.nome,
        exercicios: exerciciosFormatados,
      });

      setModeloReutilizar(null);
      notificarSucesso('Ficha de treino gerada para o aluno a partir do modelo!');
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao reutilizar modelo para o aluno.');
    } finally {
      setReutilizando(false);
    }
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Modelos de Treino</h2>
          <p>Criação, edição, duplicação e reutilização de fichas-padrão para alunos</p>
        </div>
        <div className="treinamento-acoes-header">
          <button
            type="button"
            onClick={abrirNovoModal}
            className="treinamento-btn treinamento-btn--primario"
          >
            + Novo Modelo
          </button>
          <Link to="/dashboard">← Voltar</Link>
        </div>
      </div>

      {erro && !modalAberto && !modeloReutilizar && (
        <div role="alert" className="treinamento-alerta-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div role="status" className="treinamento-alerta-sucesso">
          {sucesso}
        </div>
      )}

      <div className="treinamento-resumo-grid">
        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">MODELOS CADASTRADOS</span>
          <div className="treinamento-stat-valor">{resumo.total}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">MODELOS ATIVOS</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--sucesso">{resumo.ativos}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">EXERCÍCIOS VINCULADOS</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--primario">
            {resumo.totalItens}
          </div>
        </div>
      </div>

      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label htmlFor="busca-modelo">Pesquisar modelo</label>
            <input
              id="busca-modelo"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, divisão ou descrição do modelo..."
            />
          </div>

          <div className="treinamento-campo">
            <label htmlFor="filtro-nivel">Nível</label>
            <select
              id="filtro-nivel"
              value={filtroNivel}
              onChange={(e) => setFiltroNivel(e.target.value)}
            >
              <option value="">Todos os níveis</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="form-card">Carregando modelos de treino...</div>
      ) : modelosPaginados.length === 0 ? (
        <div className="form-card">Nenhum modelo de treino encontrado.</div>
      ) : (
        <div className="treinamento-cards-grid">
          {modelosPaginados.map((modelo) => {
            const listaEx = Array.isArray(modelo.exercicios) ? modelo.exercicios : [];

            return (
              <div key={modelo.id} className="form-card treinamento-modelo-card">
                <div>
                  <div className="treinamento-tabela-header">
                    <h4>{modelo.nome}</h4>
                    <span className="treinamento-badge treinamento-badge--neutro">
                      {NIVEL_LABEL[modelo.nivel] || modelo.nivel || 'Intermediário'}
                    </span>
                  </div>

                  <p>
                    <strong>Divisão:</strong> {modelo.divisao || 'Treino A'} •{' '}
                    <strong>{listaEx.length}</strong>{' '}
                    {listaEx.length === 1 ? 'exercício' : 'exercícios'}
                  </p>

                  {modelo.descricao && <p>{modelo.descricao}</p>}

                  {listaEx.length > 0 && (
                    <div className="treinamento-preview-lista">
                      {listaEx.slice(0, 4).map((ex, idx) => (
                        <div key={ex.id || `${modelo.id}-${idx}`} className="treinamento-preview-item">
                          <strong>
                            {idx + 1}. {ex.nome}
                          </strong>{' '}
                          — {ex.series}x{ex.repeticoes}
                          {ex.carga ? ` (${ex.carga})` : ''}
                        </div>
                      ))}
                      {listaEx.length > 4 && (
                        <div className="treinamento-preview-item">
                          + {listaEx.length - 4} outro(s) exercício(s)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="treinamento-acoes-linha">
                  <button
                    type="button"
                    onClick={() => abrirModalReutilizar(modelo)}
                    className="treinamento-btn treinamento-btn--sucesso treinamento-btn--sm"
                  >
                    Reutilizar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicarModelo(modelo)}
                    className="treinamento-btn treinamento-btn--suave-azul treinamento-btn--sm"
                  >
                    Duplicar
                  </button>

                  <button
                    type="button"
                    onClick={() => abrirEditarModal(modelo)}
                    className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExcluirModelo(modelo)}
                    className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="form-card treinamento-paginacao">
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

      {modalAberto && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card">
            <div className="treinamento-modal-header">
              <h3>{editandoModelo ? 'Editar Modelo de Treino' : 'Novo Modelo de Treino'}</h3>
              <button
                type="button"
                onClick={fecharModal}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            <form onSubmit={handleSalvarModelo} className="treinamento-grid-auto">
              <div className="treinamento-campo">
                <label htmlFor="nome-modelo">Nome do Modelo *</label>
                <input
                  id="nome-modelo"
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Adaptação Iniciante - Full Body"
                  required
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="div-modelo">Divisão Padrão</label>
                <input
                  id="div-modelo"
                  type="text"
                  value={form.divisao}
                  onChange={(e) => setForm({ ...form, divisao: e.target.value })}
                  placeholder="Ex: Treino A"
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="nivel-modelo">Nível</label>
                <select
                  id="nivel-modelo"
                  value={form.nivel}
                  onChange={(e) => setForm({ ...form, nivel: e.target.value })}
                >
                  <option value="iniciante">Iniciante</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                </select>
              </div>

              <div className="treinamento-campo">
                <label>
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  />{' '}
                  Modelo ativo
                </label>
              </div>

              <div className="treinamento-campo">
                <label htmlFor="desc-modelo">Descrição</label>
                <input
                  id="desc-modelo"
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Objetivo do modelo, frequência semanal recomendada..."
                />
              </div>

              <div className="treinamento-campo">
                <div className="treinamento-item-topo">
                  <strong>Exercícios do Modelo</strong>
                  <button
                    type="button"
                    onClick={adicionarExercicioAoForm}
                    className="treinamento-btn treinamento-btn--primario treinamento-btn--sm"
                  >
                    + Adicionar Exercício
                  </button>
                </div>

                {form.exercicios.map((item, idx) => (
                  <div key={idx} className="treinamento-item-box">
                    <div className="treinamento-item-topo">
                      <strong>#{idx + 1}</strong>
                      <div className="treinamento-acoes-linha">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moverItemExercicio(idx, -1)}
                          title="Subir"
                          className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === form.exercicios.length - 1}
                          onClick={() => moverItemExercicio(idx, 1)}
                          title="Descer"
                          className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                        >
                          ↓
                        </button>
                        {form.exercicios.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerItemExercicio(idx)}
                            className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="treinamento-item-campos">
                      <select
                        value={item.exercicio_id}
                        onChange={(e) => atualizarItemExercicio(idx, 'exercicio_id', e.target.value)}
                      >
                        <option value="">-- Selecione um exercício --</option>
                        {exerciciosCatalogo.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.nome} {ex.equipamento ? `(${ex.equipamento})` : ''}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Séries"
                        value={item.series}
                        onChange={(e) => atualizarItemExercicio(idx, 'series', e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Repetições"
                        value={item.repeticoes}
                        onChange={(e) => atualizarItemExercicio(idx, 'repeticoes', e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Carga (ex: 20kg)"
                        value={item.carga}
                        onChange={(e) => atualizarItemExercicio(idx, 'carga', e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Descanso (ex: 60s)"
                        value={item.descanso}
                        onChange={(e) => atualizarItemExercicio(idx, 'descanso', e.target.value)}
                      />

                      <input
                        type="text"
                        placeholder="Observação"
                        value={item.observacao}
                        onChange={(e) => atualizarItemExercicio(idx, 'observacao', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="treinamento-modal-footer">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="treinamento-btn treinamento-btn--neutro"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="treinamento-btn treinamento-btn--escuro"
                >
                  {salvando ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modeloReutilizar && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card treinamento-modal-card--sm">
            <div className="treinamento-modal-header">
              <h3>Reutilizar Modelo: {modeloReutilizar.nome}</h3>
              <button
                type="button"
                onClick={() => setModeloReutilizar(null)}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            <form onSubmit={handleReutilizarParaAluno} className="treinamento-grid-auto">
              <div className="treinamento-campo">
                <label>Selecione o Aluno *</label>
                <select
                  value={alunoReutilizarId}
                  onChange={(e) => setAlunoReutilizarId(e.target.value)}
                  required
                >
                  <option value="">-- Escolha um aluno --</option>
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome || a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="treinamento-campo">
                <label>Divisão da Ficha do Aluno</label>
                <input
                  type="text"
                  value={divisaoReutilizar}
                  onChange={(e) => setDivisaoReutilizar(e.target.value)}
                  required
                />
              </div>

              <div className="treinamento-modal-footer">
                <button
                  type="button"
                  onClick={() => navigate('/treinos')}
                  className="treinamento-btn treinamento-btn--suave-azul"
                >
                  Ir para Treinos →
                </button>
                <button
                  type="button"
                  onClick={() => setModeloReutilizar(null)}
                  className="treinamento-btn treinamento-btn--neutro"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={reutilizando}
                  className="treinamento-btn treinamento-btn--sucesso"
                >
                  {reutilizando ? 'Aplicando...' : 'Criar Ficha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}