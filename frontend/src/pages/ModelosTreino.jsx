import { podeAcessar } from '../permissoesProfessor';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/treinamento.css';

const ITENS_POR_PAGINA = 6;

const criarItemExercicio = (ordem = 1, base = {}) => ({
  id: base.id || null,
  exercicio_id: base.exercicio_id ? String(base.exercicio_id) : '',
  nome: base.nome || '',
  ordem,
  series: base.series || '3',
  repeticoes: base.repeticoes || '12',
  carga: base.carga || '',
  descanso: base.descanso || '60s',
  observacao: base.observacao || '',
});

const criarDivisaoInicial = (letra = 'A', ordem = 1) => ({
  id: `div-local-${Date.now()}-${ordem}`,
  nome: `Treino ${letra}`,
  descricao: '',
  ordem,
  exercicios: [criarItemExercicio(1)],
});

const estadoInicialForm = {
  nome: '',
  descricao: '',
  modalidade_id: '',
  nivel_id: '',
  nivel: 'intermediario',
  objetivo: '',
  ativo: true,
  divisoes: [criarDivisaoInicial('A', 1)],
};

export default function ModelosTreino() {
  const { usuario: usuarioAtual } = useAuth();
  const [modelos, setModelos] = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [niveis, setNiveis] = useState([]);
  const [exerciciosCatalogo, setExerciciosCatalogo] = useState([]);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroModalidade, setFiltroModalidade] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modal de Criação / Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [etapaForm, setEtapaForm] = useState(1); // 1: Geral | 2: Divisões & Exercícios
  const [editandoModelo, setEditandoModelo] = useState(null);
  const [form, setForm] = useState(estadoInicialForm);
  const [divisaoAtivaIndex, setDivisaoAtivaIndex] = useState(0);
  const [buscaExercicioBib, setBuscaExercicioBib] = useState('');

  // Modal de Detalhes
  const [modeloDetalhe, setModeloDetalhe] = useState(null);
  const [divisaoDetalheIndex, setDivisaoDetalheIndex] = useState(0);

  // Estados gerais
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Identificar academia do usuário logado
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const academiaId = usuario.academia_id == null ? null : Number(usuario.academia_id);
  const ehAdminGlobal = usuario.cargo === 'admin' && (academiaId === null || academiaId === 0);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroModalidade, filtroNivel]);

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
      const [resModelos, resModalidades, resNiveis, resExercicios] = await Promise.all([
        api.get('/modelos-treino').catch(() => ({ data: [] })),
        api.get('/modalidades').catch(() => ({ data: [] })),
        api.get('/niveis-dificuldade').catch(() => ({ data: [] })),
        api.get('/exercicios', { params: { apenas_ativos: 1 } }).catch(() => ({ data: [] })),
      ]);

      const listaModelos = Array.isArray(resModelos.data) ? resModelos.data : [];
      const listaModalidades = Array.isArray(resModalidades.data) ? resModalidades.data : [];
      const listaNiveis = Array.isArray(resNiveis.data) ? resNiveis.data : [];
      const listaExercicios = Array.isArray(resExercicios.data) ? resExercicios.data : [];

      setModelos(listaModelos);
      setModalidades(listaModalidades);
      setNiveis(listaNiveis);
      setExerciciosCatalogo(listaExercicios);
    } catch (err) {
      console.error(err);
      notificarErro('Erro ao carregar modelos de treino.');
    } finally {
      setCarregando(false);
    }
  };

  // Verificar se modelo é da biblioteca global (academia_id = 0)
  const ehModeloGlobal = (modelo) => {
    return modelo.academia_id != null && Number(modelo.academia_id) === 0;
  };

  // Filtrar modelos para exibição: globais + da academia do usuário
  const modelosFiltrados = useMemo(() => {
    return modelos.filter((m) => {
      // Primeiro: filtrar por academia (globais + da academia do usuário)
      const ehGlobal = ehModeloGlobal(m);
      const ehDaAcademia = academiaId != null && Number(m.academia_id) === academiaId;
      if (!ehGlobal && !ehDaAcademia) {
        return false;
      }

      // Depois: filtros existentes
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const matchNome = String(m.nome || '').toLowerCase().includes(termo);
        const matchDesc = String(m.descricao || '').toLowerCase().includes(termo);
        const matchObj = String(m.objetivo || '').toLowerCase().includes(termo);
        if (!matchNome && !matchDesc && !matchObj) return false;
      }

      if (filtroModalidade && String(m.modalidade_id) !== String(filtroModalidade)) {
        return false;
      }

      if (filtroNivel && String(m.nivel_id) !== String(filtroNivel) && String(m.nivel).toLowerCase() !== filtroNivel.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [modelos, busca, filtroModalidade, filtroNivel, academiaId]);

  const totalPaginas = Math.max(1, Math.ceil(modelosFiltrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const modelosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return modelosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [modelosFiltrados, paginaSegura]);

  const resumo = useMemo(() => {
    const total = modelos.length;
    const ativos = modelos.filter((m) => m.ativo !== 0 && m.ativo !== false).length;
    const totalAlunos = modelos.reduce((acc, m) => acc + Number(m.total_alunos_vinculados || 0), 0);
    return { total, ativos, totalAlunos };
  }, [modelos]);

  // Filtro da biblioteca de exercícios no modal
  const exerciciosBibFiltrados = useMemo(() => {
    if (!buscaExercicioBib.trim()) return exerciciosCatalogo.slice(0, 8);
    const termo = buscaExercicioBib.trim().toLowerCase();
    return exerciciosCatalogo
      .filter((ex) => {
        const nome = String(ex.nome || '').toLowerCase();
        const equip = String(ex.equipamento || '').toLowerCase();
        return nome.includes(termo) || equip.includes(termo);
      })
      .slice(0, 10);
  }, [exerciciosCatalogo, buscaExercicioBib]);

  // --- GERENCIAMENTO DE DIVISÕES E EXERCÍCIOS NO FORMULÁRIO ---
  const divisaoAtual = form.divisoes[divisaoAtivaIndex] || form.divisoes[0];

  const adicionarDivisao = () => {
    const proximaLetra = String.fromCharCode(65 + form.divisoes.length);
    const novaDiv = criarDivisaoInicial(proximaLetra, form.divisoes.length + 1);
    setForm((prev) => ({
      ...prev,
      divisoes: [...prev.divisoes, novaDiv],
    }));
    setDivisaoAtivaIndex(form.divisoes.length);
  };

  const duplicarDivisaoAtual = () => {
    if (!divisaoAtual) return;
    const novaDiv = {
      ...divisaoAtual,
      id: `div-local-${Date.now()}`,
      nome: `${divisaoAtual.nome} (Cópia)`,
      ordem: form.divisoes.length + 1,
      exercicios: (divisaoAtual.exercicios || []).map((ex, idx) =>
        criarItemExercicio(idx + 1, { ...ex, id: null })
      ),
    };
    setForm((prev) => ({
      ...prev,
      divisoes: [...prev.divisoes, novaDiv],
    }));
    setDivisaoAtivaIndex(form.divisoes.length);
  };

  const removerDivisaoAtual = () => {
    if (form.divisoes.length <= 1) return;
    setForm((prev) => {
      const filtradas = prev.divisoes.filter((_, idx) => idx !== divisaoAtivaIndex);
      const reordenadas = filtradas.map((d, i) => ({ ...d, ordem: i + 1 }));
      return { ...prev, divisoes: reordenadas };
    });
    setDivisaoAtivaIndex((prev) => Math.max(0, prev - 1));
  };

  const atualizarDivisaoAtual = (campo, valor) => {
    setForm((prev) => {
      const copia = [...prev.divisoes];
      copia[divisaoAtivaIndex] = { ...copia[divisaoAtivaIndex], [campo]: valor };
      return { ...prev, divisoes: copia };
    });
  };

  const adicionarExercicioNaDivisao = (exCatalogo = null) => {
    setForm((prev) => {
      const copiaDivs = [...prev.divisoes];
      const divAtual = copiaDivs[divisaoAtivaIndex];
      const listaEx = divAtual.exercicios || [];
      const novoEx = criarItemExercicio(listaEx.length + 1, {
        exercicio_id: exCatalogo ? exCatalogo.id : '',
        nome: exCatalogo ? exCatalogo.nome : '',
      });
      copiaDivs[divisaoAtivaIndex] = {
        ...divAtual,
        exercicios: [...listaEx, novoEx],
      };
      return { ...prev, divisoes: copiaDivs };
    });
  };

  const atualizarExercicioNaDivisao = (exIndex, campo, valor) => {
    setForm((prev) => {
      const copiaDivs = [...prev.divisoes];
      const divAtual = copiaDivs[divisaoAtivaIndex];
      const listaEx = [...divAtual.exercicios];

      if (campo === 'exercicio_id') {
        const achado = exerciciosCatalogo.find((c) => String(c.id) === String(valor));
        listaEx[exIndex] = {
          ...listaEx[exIndex],
          exercicio_id: valor,
          nome: achado ? achado.nome : listaEx[exIndex].nome,
        };
      } else {
        listaEx[exIndex] = { ...listaEx[exIndex], [campo]: valor };
      }

      copiaDivs[divisaoAtivaIndex] = { ...divAtual, exercicios: listaEx };
      return { ...prev, divisoes: copiaDivs };
    });
  };

  const moverExercicioNaDivisao = (exIndex, direcao) => {
    const destino = exIndex + direcao;
    setForm((prev) => {
      const copiaDivs = [...prev.divisoes];
      const divAtual = copiaDivs[divisaoAtivaIndex];
      const listaEx = [...divAtual.exercicios];

      if (destino < 0 || destino >= listaEx.length) return prev;
      const [removido] = listaEx.splice(exIndex, 1);
      listaEx.splice(destino, 0, removido);

      copiaDivs[divisaoAtivaIndex] = {
        ...divAtual,
        exercicios: listaEx.map((ex, i) => ({ ...ex, ordem: i + 1 })),
      };
      return { ...prev, divisoes: copiaDivs };
    });
  };

  const removerExercicioNaDivisao = (exIndex) => {
    setForm((prev) => {
      const copiaDivs = [...prev.divisoes];
      const divAtual = copiaDivs[divisaoAtivaIndex];
      const filtrados = (divAtual.exercicios || []).filter((_, idx) => idx !== exIndex);
      copiaDivs[divisaoAtivaIndex] = {
        ...divAtual,
        exercicios: filtrados.map((ex, i) => ({ ...ex, ordem: i + 1 })),
      };
      return { ...prev, divisoes: copiaDivs };
    });
  };

  // --- ABERTURA E FECHAMENTO DE MODAIS ---
  const abrirNovoModal = () => {
    setEditandoModelo(null);
    setEtapaForm(1);
    setForm({
      ...estadoInicialForm,
      modalidade_id: modalidades[0]?.id ? String(modalidades[0].id) : '',
      nivel_id: niveis[0]?.id ? String(niveis[0].id) : '',
      divisoes: [criarDivisaoInicial('A', 1)],
    });
    setDivisaoAtivaIndex(0);
    setErro('');
    setModalAberto(true);
  };

  const abrirEditarModal = (modelo) => {
    if (ehModeloGlobal(modelo) && !ehAdminGlobal) {
      notificarErro('Modelos globais não podem ser editados pela academia. Duplique o modelo primeiro.');
      return;
    }
    setEditandoModelo(modelo);
    setEtapaForm(1);

    const divisoesTratadas =
      Array.isArray(modelo.divisoes) && modelo.divisoes.length > 0
        ? modelo.divisoes.map((d, i) => ({
            id: d.id,
            nome: d.nome || `Treino ${String.fromCharCode(65 + i)}`,
            descricao: d.descricao || '',
            ordem: d.ordem || i + 1,
            exercicios:
              Array.isArray(d.exercicios) && d.exercicios.length > 0
                ? d.exercicios.map((ex, idxEx) =>
                    criarItemExercicio(idxEx + 1, {
                      id: ex.id,
                      exercicio_id: ex.exercicio_id,
                      nome: ex.nome,
                      series: ex.series,
                      repeticoes: ex.repeticoes,
                      carga: ex.carga,
                      descanso: ex.descanso,
                      observacao: ex.observacao,
                    })
                  )
                : [criarItemExercicio(1)],
          }))
        : [criarDivisaoInicial('A', 1)];

    setForm({
      nome: modelo.nome || '',
      descricao: modelo.descricao || '',
      modalidade_id: modelo.modalidade_id ? String(modelo.modalidade_id) : '',
      nivel_id: modelo.nivel_id ? String(modelo.nivel_id) : '',
      nivel: modelo.nivel || 'intermediario',
      objetivo: modelo.objetivo || '',
      ativo: modelo.ativo !== 0 && modelo.ativo !== false,
      divisoes: divisoesTratadas,
    });
    setDivisaoAtivaIndex(0);
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

    // Normaliza divisões e exercícios antes de enviar
    const divisoesPayload = form.divisoes.map((d, idxDiv) => ({
      nome: d.nome && d.nome.trim() ? d.nome.trim() : `Treino ${String.fromCharCode(65 + idxDiv)}`,
      descricao: d.descricao ? d.descricao.trim() : null,
      ordem: idxDiv + 1,
      exercicios: (d.exercicios || [])
        .filter((ex) => Boolean(ex.exercicio_id))
        .map((ex, idxEx) => ({
          exercicio_id: Number(ex.exercicio_id),
          ordem: idxEx + 1,
          series: String(ex.series || '3').trim(),
          repeticoes: String(ex.repeticoes || '12').trim(),
          carga: ex.carga ? String(ex.carga).trim() : null,
          descanso: ex.descanso ? String(ex.descanso).trim() : null,
          observacao: ex.observacao ? String(ex.observacao).trim() : null,
        })),
    }));

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        modalidade_id: form.modalidade_id ? Number(form.modalidade_id) : null,
        nivel_id: form.nivel_id ? Number(form.nivel_id) : null,
        nivel: form.nivel || 'intermediario',
        objetivo: form.objetivo.trim() || null,
        ativo: form.ativo ? 1 : 0,
        divisoes: divisoesPayload,
      };

      if (editandoModelo) {
        await api.put(`/modelos-treino/${editandoModelo.id}`, payload);
        notificarSucesso('Modelo de treino atualizado com sucesso! Alunos vinculados agora verão as atualizações.');
      } else {
        await api.post('/modelos-treino', payload);
        notificarSucesso('Modelo de treino criado com sucesso!');
      }

      setModalAberto(false);
      setEditandoModelo(null);
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
      notificarErro(err?.response?.data?.erro || 'Erro ao duplicar modelo.');
    }
  };

  const handleExcluirModelo = async (modelo) => {
    if (ehModeloGlobal(modelo) && !ehAdminGlobal) {
      notificarErro('Modelos globais não podem ser excluídos pela academia.');
      return;
    }
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

  const abrirDetalheModelo = (modelo) => {
    setModeloDetalhe(modelo);
    setDivisaoDetalheIndex(0);
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Modelos de Treino</h2>
          <p>Modelos compartilhados com divisões ilimitadas, atribuição a múltiplos alunos e edição centralizada</p>
        </div>
        <div className="treinamento-acoes-header">
          <button
            type="button"
            disabled={!podeAcessar(usuarioAtual,'modelos','criar')} onClick={abrirNovoModal}
            className="treinamento-btn treinamento-btn--primario"
          >
            + Novo Modelo
          </button>
          <Link to="/dashboard">← Voltar</Link>
        </div>
      </div>

      {erro && !modalAberto && (
        <div role="alert" className="treinamento-alerta-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div role="status" className="treinamento-alerta-sucesso">
          {sucesso}
        </div>
      )}

      {/* Indicadores */}
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
          <span className="treinamento-stat-label">ALUNOS COM MODELOS ATIVOS</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--primario">
            {resumo.totalAlunos}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label htmlFor="busca-modelo">Pesquisar modelo</label>
            <input
              id="busca-modelo"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, objetivo ou descrição do modelo..."
            />
          </div>

          <div className="treinamento-campo">
            <label htmlFor="filtro-mod">Modalidade</label>
            <select
              id="filtro-mod"
              value={filtroModalidade}
              onChange={(e) => setFiltroModalidade(e.target.value)}
            >
              <option value="">Todas as modalidades</option>
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="treinamento-campo">
            <label htmlFor="filtro-niv">Nível</label>
            <select
              id="filtro-niv"
              value={filtroNivel}
              onChange={(e) => setFiltroNivel(e.target.value)}
            >
              <option value="">Todos os níveis</option>
              {niveis.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Modelos */}
      {carregando ? (
        <div className="form-card">Carregando modelos de treino...</div>
      ) : modelosPaginados.length === 0 ? (
        <div className="form-card">Nenhum modelo de treino encontrado com os filtros selecionados.</div>
      ) : (
        <div className="treinamento-cards-grid">
          {modelosPaginados.map((modelo) => {
            const divisoes = Array.isArray(modelo.divisoes) ? modelo.divisoes : [];
            const totalExercicios = divisoes.reduce(
              (acc, d) => acc + (Array.isArray(d.exercicios) ? d.exercicios.length : 0),
              0
            );

            return (
              <div key={modelo.id} className="form-card treinamento-modelo-card">
                <div>
                  <div className="treinamento-tabela-header">
                    <h4>{modelo.nome}</h4>
                    <span className="treinamento-badge treinamento-badge--neutro">
                      {modelo.nivel_nome || modelo.nivel || 'Intermediário'}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                    {modelo.modalidade_nome && (
                      <span className="treinamento-badge treinamento-badge--azul" style={{ marginRight: '0.5rem' }}>
                        {modelo.modalidade_nome}
                      </span>
                    )}
                    <span
                      className={`treinamento-badge ${
                        modelo.ativo === 1 ? 'treinamento-badge--sucesso' : 'treinamento-badge--neutro'
                      }`}
                    >
                      {modelo.ativo === 1 ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  <p>
                    <strong>Divisões: </strong>
                    {divisoes.length === 0
                      ? 'Nenhuma divisão cadastrada'
                      : divisoes.map((d) => d.nome).join(' • ')}
                  </p>

                  <p>
                    <strong>Total de Exercícios: </strong>
                    {totalExercicios} {totalExercicios === 1 ? 'exercício' : 'exercícios'}
                  </p>

                  <p>
                    <strong>Alunos Vinculados: </strong>
                    <span className="treinamento-badge treinamento-badge--teal">
                      👥 {Number(modelo.total_alunos_vinculados || 0)} aluno(s)
                    </span>
                  </p>

                  {modelo.objetivo && (
                    <p>
                      <strong>Objetivo: </strong>
                      {modelo.objetivo}
                    </p>
                  )}
                </div>

                <div className="treinamento-acoes-linha" style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => abrirDetalheModelo(modelo)}
                    className="treinamento-btn treinamento-btn--suave-azul treinamento-btn--sm"
                  >
                    Visualizar Divisões
                  </button>

                  <button
                    type="button"
                    disabled={!podeAcessar(usuarioAtual,'modelos','criar')} onClick={() => handleDuplicarModelo(modelo)}
                    className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                  >
                    Duplicar
                  </button>

                  {(!ehModeloGlobal(modelo) || ehAdminGlobal) && <button
                    type="button"
                    disabled={!podeAcessar(usuarioAtual,'modelos','editar')} onClick={() => abrirEditarModal(modelo)}
                    className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                  >
                    Editar
                  </button>}

                  {(!ehModeloGlobal(modelo) || ehAdminGlobal) && <button
                    type="button"
                    disabled={!podeAcessar(usuarioAtual,'modelos','excluir')} onClick={() => handleExcluirModelo(modelo)}
                    className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                  >
                    Excluir
                  </button>}
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

      {/* MODAL DE CRIAÇÃO / EDIÇÃO ORGANIZADO EM ETAPAS */}
      {modalAberto && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card">
            <div className="treinamento-modal-header">
              <h3>{editandoModelo ? `Editar Modelo: ${editandoModelo.nome}` : 'Novo Modelo de Treino'}</h3>
              <button
                type="button"
                onClick={fecharModal}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {/* Aviso de modelo compartilhado se houver alunos atrelados */}
            {editandoModelo && Number(editandoModelo.total_alunos_vinculados || 0) > 0 && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  color: '#92400e',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem',
                }}
              >
                ⚠️ <strong>Atenção (Modelo Compartilhado):</strong> Este modelo possui{' '}
                <strong>{editandoModelo.total_alunos_vinculados} aluno(s)</strong> vinculado(s). Quaisquer alterações
                feitas nas divisões ou exercícios refletirão em tempo real para as fichas de todos esses alunos.
              </div>
            )}

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            {/* Seletor de Etapas */}
            <div className="treinamento-acoes-linha" style={{ marginBottom: '1.25rem', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setEtapaForm(1)}
                className={`treinamento-btn ${
                  etapaForm === 1 ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
                }`}
              >
                1. Informações Gerais
              </button>
              <button
                type="button"
                onClick={() => setEtapaForm(2)}
                className={`treinamento-btn ${
                  etapaForm === 2 ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
                }`}
              >
                2. Divisões & Exercícios ({form.divisoes.length})
              </button>
            </div>

            <form onSubmit={handleSalvarModelo}>
              {/* ETAPA 1: INFORMAÇÕES GERAIS */}
              {etapaForm === 1 && (
                <div className="treinamento-grid-auto">
                  <div className="treinamento-campo">
                    <label htmlFor="nome-modelo">Nome do Modelo *</label>
                    <input
                      id="nome-modelo"
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      placeholder="Ex: Treino ABC — Hipertrofia Clássica"
                      required
                    />
                  </div>

                  <div className="treinamento-campo">
                    <label htmlFor="mod-modelo">Modalidade</label>
                    <select
                      id="mod-modelo"
                      value={form.modalidade_id}
                      onChange={(e) => setForm({ ...form, modalidade_id: e.target.value })}
                    >
                      <option value="">-- Selecione uma modalidade --</option>
                      {modalidades.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="treinamento-campo">
                    <label htmlFor="niv-modelo">Nível de Dificuldade</label>
                    <select
                      id="niv-modelo"
                      value={form.nivel_id}
                      onChange={(e) => {
                        const nivObj = niveis.find((n) => String(n.id) === e.target.value);
                        setForm({
                          ...form,
                          nivel_id: e.target.value,
                          nivel: nivObj?.slug || form.nivel,
                        });
                      }}
                    >
                      <option value="">-- Selecione um nível --</option>
                      {niveis.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="treinamento-campo">
                    <label htmlFor="obj-modelo">Objetivo</label>
                    <input
                      id="obj-modelo"
                      type="text"
                      value={form.objetivo}
                      onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
                      placeholder="Ex: Ganho de massa muscular, queima calórica, mobilidade..."
                    />
                  </div>

                  <div className="treinamento-campo">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.ativo}
                        onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                      />{' '}
                      Modelo ativo para novas atribuições
                    </label>
                  </div>

                  <div className="treinamento-campo">
                    <label htmlFor="desc-modelo">Descrição do Modelo</label>
                    <textarea
                      id="desc-modelo"
                      rows={3}
                      value={form.descricao}
                      onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                      placeholder="Diretrizes do modelo, frequência semanal recomendada e observações..."
                    />
                  </div>

                  <div className="treinamento-modal-footer">
                    <button
                      type="button"
                      onClick={() => setEtapaForm(2)}
                      className="treinamento-btn treinamento-btn--primario"
                    >
                      Avançar para Divisões e Exercícios →
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 2: DIVISÕES & EXERCÍCIOS */}
              {etapaForm === 2 && (
                <div>
                  {/* Seletor de Divisões em Abas */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: '0.75rem',
                    }}
                  >
                    {form.divisoes.map((div, idx) => (
                      <button
                        key={div.id || idx}
                        type="button"
                        onClick={() => setDivisaoAtivaIndex(idx)}
                        className={`treinamento-btn ${
                          divisaoAtivaIndex === idx
                            ? 'treinamento-btn--escuro'
                            : 'treinamento-btn--neutro'
                        } treinamento-btn--sm`}
                      >
                        {div.nome || `Treino ${String.fromCharCode(65 + idx)}`} ({div.exercicios?.length || 0})
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={adicionarDivisao}
                      className="treinamento-btn treinamento-btn--suave-azul treinamento-btn--sm"
                    >
                      + Nova Divisão
                    </button>
                  </div>

                  {divisaoAtual && (
                    <div className="form-card" style={{ background: '#f9fafb', marginBottom: '1.25rem' }}>
                      <div className="treinamento-grid-auto" style={{ marginBottom: '1rem' }}>
                        <div className="treinamento-campo">
                          <label>Nome da Divisão *</label>
                          <input
                            type="text"
                            value={divisaoAtual.nome}
                            onChange={(e) => atualizarDivisaoAtual('nome', e.target.value)}
                            placeholder="Ex: Treino A — Peito e Tríceps"
                            required
                          />
                        </div>

                        <div className="treinamento-campo">
                          <label>Descrição da Divisão</label>
                          <input
                            type="text"
                            value={divisaoAtual.descricao}
                            onChange={(e) => atualizarDivisaoAtual('descricao', e.target.value)}
                            placeholder="Foco muscular ou orientações específicas..."
                          />
                        </div>
                      </div>

                      <div className="treinamento-acoes-linha" style={{ marginBottom: '1rem' }}>
                        <button
                          type="button"
                          onClick={duplicarDivisaoAtual}
                          className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                        >
                          📋 Duplicar esta Divisão
                        </button>
                        {form.divisoes.length > 1 && (
                          <button
                            type="button"
                            onClick={removerDivisaoAtual}
                            className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                          >
                            🗑️ Excluir esta Divisão
                          </button>
                        )}
                      </div>

                      {/* Biblioteca rápida de exercícios */}
                      <div className="treinamento-biblioteca-box" style={{ marginBottom: '1.25rem' }}>
                        <div className="treinamento-biblioteca-topo">
                          <strong>Adicionar da Biblioteca de Exercícios</strong>
                          <input
                            type="text"
                            value={buscaExercicioBib}
                            onChange={(e) => setBuscaExercicioBib(e.target.value)}
                            placeholder="Filtrar por nome ou equipamento..."
                            className="treinamento-biblioteca-busca"
                          />
                        </div>

                        <div className="treinamento-chips-wrap">
                          {exerciciosBibFiltrados.map((ex) => (
                            <button
                              key={ex.id}
                              type="button"
                              onClick={() => adicionarExercicioNaDivisao(ex)}
                              className="treinamento-chip treinamento-chip--ativo-azul"
                            >
                              + {ex.nome}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lista de Exercícios da Divisão */}
                      <div className="exercicios-container">
                        <div className="treinamento-tabela-header">
                          <h4>Exercícios de {divisaoAtual.nome}</h4>
                          <button
                            type="button"
                            onClick={() => adicionarExercicioNaDivisao(null)}
                            className="treinamento-btn treinamento-btn--primario treinamento-btn--sm"
                          >
                            + Exercício Manual
                          </button>
                        </div>

                        {(!divisaoAtual.exercicios || divisaoAtual.exercicios.length === 0) ? (
                          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                            Nenhum exercício adicionado a esta divisão ainda. Clique em um dos exercícios acima ou em "+ Exercício Manual".
                          </p>
                        ) : (
                          divisaoAtual.exercicios.map((ex, exIdx) => (
                            <div key={ex.id || exIdx} className="treinamento-item-box">
                              <div className="treinamento-item-topo">
                                <strong>#{exIdx + 1} {ex.nome ? `— ${ex.nome}` : ''}</strong>
                                <div className="treinamento-acoes-linha">
                                  <button
                                    type="button"
                                    disabled={exIdx === 0}
                                    onClick={() => moverExercicioNaDivisao(exIdx, -1)}
                                    title="Mover para cima"
                                    className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={exIdx === divisaoAtual.exercicios.length - 1}
                                    onClick={() => moverExercicioNaDivisao(exIdx, 1)}
                                    title="Mover para baixo"
                                    className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removerExercicioNaDivisao(exIdx)}
                                    className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              <div className="treinamento-item-campos">
                                <select
                                  value={ex.exercicio_id}
                                  onChange={(e) => atualizarExercicioNaDivisao(exIdx, 'exercicio_id', e.target.value)}
                                  required
                                >
                                  <option value="">-- Selecione o exercício --</option>
                                  {exerciciosCatalogo.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.nome} {cat.equipamento ? `(${cat.equipamento})` : ''}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  type="text"
                                  placeholder="Séries (ex: 3)"
                                  value={ex.series}
                                  onChange={(e) => atualizarExercicioNaDivisao(exIdx, 'series', e.target.value)}
                                />

                                <input
                                  type="text"
                                  placeholder="Repetições (ex: 10-12)"
                                  value={ex.repeticoes}
                                  onChange={(e) => atualizarExercicioNaDivisao(exIdx, 'repeticoes', e.target.value)}
                                />

                                <input
                                  type="text"
                                  placeholder="Carga Sugerida (ex: 20kg)"
                                  value={ex.carga}
                                  onChange={(e) => atualizarExercicioNaDivisao(exIdx, 'carga', e.target.value)}
                                />

                                <input
                                  type="text"
                                  placeholder="Descanso (ex: 60s)"
                                  value={ex.descanso}
                                  onChange={(e) => atualizarExercicioNaDivisao(exIdx, 'descanso', e.target.value)}
                                />

                                <input
                                  type="text"
                                  placeholder="Observação técnica"
                                  value={ex.observacao}
                                  onChange={(e) => atualizarExercicioNaDivisao(exIdx, 'observacao', e.target.value)}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <div className="treinamento-modal-footer">
                    <button
                      type="button"
                      onClick={() => setEtapaForm(1)}
                      className="treinamento-btn treinamento-btn--neutro"
                    >
                      ← Voltar para Informações Gerais
                    </button>
                    <button
                      type="submit"
                      disabled={salvando}
                      className="treinamento-btn treinamento-btn--escuro"
                    >
                      {salvando ? 'Salvando Modelo...' : 'Salvar Modelo de Treino Completo'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DO MODELO */}
      {modeloDetalhe && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card">
            <div className="treinamento-modal-header">
              <div>
                <h3>{modeloDetalhe.nome}</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
                  {modeloDetalhe.modalidade_nome ? `${modeloDetalhe.modalidade_nome} • ` : ''}
                  {modeloDetalhe.nivel_nome || modeloDetalhe.nivel || 'Intermediário'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModeloDetalhe(null)}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {modeloDetalhe.descricao && (
              <p style={{ marginTop: '0.5rem', marginBottom: '1rem', color: '#4b5563' }}>
                {modeloDetalhe.descricao}
              </p>
            )}

            {/* Abas das Divisões */}
            {(!modeloDetalhe.divisoes || modeloDetalhe.divisoes.length === 0) ? (
              <p>Nenhuma divisão configurada neste modelo.</p>
            ) : (
              <div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.5rem',
                  }}
                >
                  {modeloDetalhe.divisoes.map((d, idx) => (
                    <button
                      key={d.id || idx}
                      type="button"
                      onClick={() => setDivisaoDetalheIndex(idx)}
                      className={`treinamento-btn ${
                        divisaoDetalheIndex === idx
                          ? 'treinamento-btn--escuro'
                          : 'treinamento-btn--neutro'
                      } treinamento-btn--sm`}
                    >
                      {d.nome} ({d.exercicios?.length || 0})
                    </button>
                  ))}
                </div>

                {modeloDetalhe.divisoes[divisaoDetalheIndex] && (
                  <div>
                    {modeloDetalhe.divisoes[divisaoDetalheIndex].descricao && (
                      <p style={{ fontStyle: 'italic', color: '#6b7280' }}>
                        {modeloDetalhe.divisoes[divisaoDetalheIndex].descricao}
                      </p>
                    )}

                    <div className="treinamento-preview-lista">
                      {(modeloDetalhe.divisoes[divisaoDetalheIndex].exercicios || []).map((ex, idx) => (
                        <div key={ex.id || idx} className="treinamento-preview-item">
                          <div>
                            <strong>
                              {idx + 1}. {ex.nome}
                            </strong>{' '}
                            — {ex.series}x{ex.repeticoes}
                            {ex.carga ? ` (${ex.carga})` : ''}
                            {ex.descanso ? ` • Descanso: ${ex.descanso}` : ''}
                          </div>
                          {ex.observacao && (
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                              Obs: {ex.observacao}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="treinamento-modal-footer" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setModeloDetalhe(null)}
                className="treinamento-btn treinamento-btn--escuro"
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
