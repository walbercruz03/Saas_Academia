import { podeAcessar } from '../permissoesProfessor';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/treinamento.css';

const ITENS_POR_PAGINA = 6;

const estadoInicialForm = {
  nome: '',
  descricao: '',
  instrucoes: '',
  equipamento: '',
  dificuldade: 'intermediario',
  imagem_url: '',
  video_url: '',
  ativo: true,
  grupos_principais: [],
  grupos_secundarios: [],
};

export default function Exercicios() {
  const { usuario: usuarioAtual } = useAuth();
  const [exercicios, setExercicios] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [niveisDificuldade, setNiveisDificuldade] = useState([]);

  const [busca, setBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroDificuldade, setFiltroDificuldade] = useState('');
  const [filtroEquipamento, setFiltroEquipamento] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoExercicio, setEditandoExercicio] = useState(null);
  const [detalheExercicio, setDetalheExercicio] = useState(null);
  const [form, setForm] = useState(estadoInicialForm);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Identificar academia do usuário logado
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const academiaId = usuario.academia_id == null ? null : Number(usuario.academia_id);
  const ehAdminGlobal = usuario.cargo === 'admin' && academiaId === 0;

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroGrupo, filtroDificuldade, filtroEquipamento]);

  const notificarSucesso = (msg) => {
    setErro('');
    setSucesso(msg);
  };

  const notificarErro = (msg) => {
    setSucesso('');
    setErro(msg);
  };

  // Verificar se exercício é da biblioteca global (academia_id = 0)
  const ehExercicioGlobal = (ex) => {
    return ex.academia_id != null && Number(ex.academia_id) === 0;
  };

  const carregarDados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [resExercicios, resGrupos, resNiveis] = await Promise.all([
        api.get('/exercicios').catch(() => ({ data: [] })),
        api.get('/grupos-musculares').catch(() => ({ data: [] })),
        api.get('/niveis-dificuldade').catch(() => ({ data: [] })),
      ]);

      const listaExercicios = Array.isArray(resExercicios.data)
        ? resExercicios.data
        : resExercicios.data?.exercicios || [];
      const listaGrupos = Array.isArray(resGrupos.data)
        ? resGrupos.data
        : resGrupos.data?.grupos || [];
      const listaNiveis = Array.isArray(resNiveis.data)
        ? resNiveis.data
        : resNiveis.data?.niveis || [];

      setExercicios(listaExercicios);
      setGrupos(listaGrupos);
      setNiveisDificuldade(listaNiveis);
    } catch (err) {
      console.error(err);
      notificarErro('Erro ao carregar biblioteca de exercícios.');
    } finally {
      setCarregando(false);
    }
  };

  const obterRotuloDificuldade = useMemo(() => {
    const mapa = {};
    niveisDificuldade.forEach((n) => {
      if (n.slug) mapa[n.slug.toLowerCase()] = n.nome;
      if (n.nome) mapa[n.nome.toLowerCase()] = n.nome;
    });
    return (slug) => {
      if (!slug) return 'Intermediário';
      const key = String(slug).toLowerCase();
      return mapa[key] || slug.charAt(0).toUpperCase() + slug.slice(1);
    };
  }, [niveisDificuldade]);

  const equipamentosDisponiveis = useMemo(() => {
    const setEq = new Set();
    exercicios.forEach((ex) => {
      if (ex.equipamento && String(ex.equipamento).trim()) {
        setEq.add(String(ex.equipamento).trim());
      }
    });
    return Array.from(setEq).sort((a, b) => a.localeCompare(b));
  }, [exercicios]);

  const exerciciosFiltrados = useMemo(() => {
    return exercicios.filter((ex) => {
      // Filtrar por academia: mostrar globais + da academia do usuário
      const ehGlobal = ehExercicioGlobal(ex);
      const ehDaAcademia = !ehGlobal && academiaId != null && Number(ex.academia_id) === academiaId;

      // Se não for global e não for da academia do usuário, excluir
      if (!ehGlobal && !ehDaAcademia) {
        return false;
      }

      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const matchNome = String(ex.nome || '').toLowerCase().includes(termo);
        const matchDesc = String(ex.descricao || '').toLowerCase().includes(termo);
        const matchEq = String(ex.equipamento || '').toLowerCase().includes(termo);
        if (!matchNome && !matchDesc && !matchEq) return false;
      }

      if (filtroDificuldade && String(ex.dificuldade || '').toLowerCase() !== filtroDificuldade) {
        return false;
      }

      if (filtroEquipamento && String(ex.equipamento || '').toLowerCase() !== filtroEquipamento.toLowerCase()) {
        return false;
      }

      if (filtroGrupo) {
        const principais = (ex.grupos_principais || []).map((g) => String(g.id));
        const secundarios = (ex.grupos_secundarios || []).map((g) => String(g.id));
        if (!principais.includes(String(filtroGrupo)) && !secundarios.includes(String(filtroGrupo))) {
          return false;
        }
      }

      return true;
    });
  }, [exercicios, busca, filtroGrupo, filtroDificuldade, filtroEquipamento, academiaId]);

  const totalPaginas = Math.max(1, Math.ceil(exerciciosFiltrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const exerciciosPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return exerciciosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [exerciciosFiltrados, paginaSegura]);

  const resumo = useMemo(() => {
    const total = exercicios.length;
    const ativos = exercicios.filter((e) => e.ativo !== 0 && e.ativo !== false).length;
    const comMidia = exercicios.filter((e) => e.imagem_url || e.video_url).length;
    return { total, ativos, comMidia };
  }, [exercicios]);

  const alternarGrupo = (campo, grupoId) => {
    const idNum = Number(grupoId);
    setForm((prev) => {
      const atual = prev[campo] || [];
      const existe = atual.includes(idNum);
      const proximo = existe ? atual.filter((id) => id !== idNum) : [...atual, idNum];
      return { ...prev, [campo]: proximo };
    });
  };

  const abrirNovoModal = () => {
    setEditandoExercicio(null);
    setForm(estadoInicialForm);
    setErro('');
    setModalAberto(true);
  };

  const abrirEditarModal = (ex) => {
    setEditandoExercicio(ex);
    setForm({
      nome: ex.nome || '',
      descricao: ex.descricao || '',
      instrucoes: ex.instrucoes || '',
      equipamento: ex.equipamento || '',
      dificuldade: ex.dificuldade || 'intermediario',
      imagem_url: ex.imagem_url || '',
      video_url: ex.video_url || '',
      ativo: ex.ativo !== 0 && ex.ativo !== false,
      grupos_principais: (ex.grupos_principais || []).map((g) => Number(g.id)),
      grupos_secundarios: (ex.grupos_secundarios || []).map((g) => Number(g.id)),
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setEditandoExercicio(null);
    setForm(estadoInicialForm);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do exercício.');
      return;
    }

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        instrucoes: form.instrucoes.trim() || null,
        equipamento: form.equipamento.trim() || null,
        dificuldade: form.dificuldade,
        imagem_url: form.imagem_url.trim() || null,
        video_url: form.video_url.trim() || null,
        ativo: form.ativo ? 1 : 0,
        grupos_principais: form.grupos_principais,
        grupos_secundarios: form.grupos_secundarios,
      };

      if (editandoExercicio) {
        await api.put(`/exercicios/${editandoExercicio.id}`, payload);
        notificarSucesso('Exercício atualizado com sucesso!');
      } else {
        await api.post('/exercicios', payload);
        notificarSucesso('Exercício cadastrado com sucesso!');
      }

      setModalAberto(false);
      setEditandoExercicio(null);
      setForm(estadoInicialForm);
      await carregarDados();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao salvar exercício.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (ex) => {
    if (!window.confirm(`Deseja realmente excluir o exercício "${ex.nome}"?`)) return;

    setErro('');
    setSucesso('');
    try {
      await api.delete(`/exercicios/${ex.id}`);
      notificarSucesso('Exercício excluído com sucesso!');
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao excluir exercício.');
    }
  };

  const duplicarExercicio = async (ex) => {
    // Impedir duplicar exercícios que já são da academia (só permite duplicar do sistema)
    if (!ehExercicioGlobal(ex)) {
      notificarErro('Não é possível duplicar exercícios da sua academia. Use os próprios exercícios da academia.');
      return;
    }

    if (academiaId == null || academiaId <= 0) {
      notificarErro('É necessária uma academia autenticada para duplicar.');
      return;
    }
    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: `${ex.nome} (Cópia)`,
        descricao: ex.descricao || '',
        equipamento: ex.equipamento || '',
        dificuldade: ex.dificuldade,
        instrucoes: ex.instrucoes || '',
        imagem_url: ex.imagem_url || null,
        video_url: ex.video_url || null,
        ativo: ex.ativo ? 1 : 0,
        grupos_principais: (ex.grupos_principais || []).map(g => Number(g.id)),
        grupos_secundarios: (ex.grupos_secundarios || []).map(g => Number(g.id)),
      };

      await api.post('/exercicios', payload);
      notificarSucesso('Exercício duplicado para sua academia com sucesso!');
      setSalvando(false);
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao duplicar exercício.');
    } finally {
      setSalvando(false);
    }
  };

  const limparFiltros = () => {
    setBusca('');
    setFiltroGrupo('');
    setFiltroDificuldade('');
    setFiltroEquipamento('');
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Exercícios</h2>
          <p>Biblioteca de exercícios com grupos musculares, equipamentos, dificuldade e mídia</p>
        </div>
        <div className="treinamento-acoes-header">
          <button
            type="button"
            disabled={!podeAcessar(usuarioAtual,'exercicios','criar')} onClick={abrirNovoModal}
            className="treinamento-btn treinamento-btn--primario"
          >
            + Novo Exercício
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

      <div className="treinamento-resumo-grid">
        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">TOTAL DE EXERCÍCIOS</span>
          <div className="treinamento-stat-valor">{resumo.total}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">EXERCÍCIOS ATIVOS</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--sucesso">{resumo.ativos}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">COM IMAGEM OU VÍDEO</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--primario">
            {resumo.comMidia}
          </div>
        </div>
      </div>

      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label htmlFor="busca-ex">Pesquisar</label>
            <input
              id="busca-ex"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, equipamento ou descrição..."
            />
          </div>

          <div className="treinamento-campo">
            <label htmlFor="filtro-grupo">Grupo Muscular</label>
            <select
              id="filtro-grupo"
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
            >
              <option value="">Todos os grupos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="treinamento-campo">
            <label htmlFor="filtro-dif">Dificuldade</label>
            <select
              id="filtro-dif"
              value={filtroDificuldade}
              onChange={(e) => setFiltroDificuldade(e.target.value)}
            >
              <option value="">Todas as dificuldades</option>
              {niveisDificuldade.map((n) => (
                <option key={n.id} value={n.slug}>
                  {n.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="treinamento-campo">
            <label htmlFor="filtro-eq">Equipamento</label>
            <select
              id="filtro-eq"
              value={filtroEquipamento}
              onChange={(e) => setFiltroEquipamento(e.target.value)}
            >
              <option value="">Todos os equipamentos</option>
              {equipamentosDisponiveis.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </div>

          {(busca || filtroGrupo || filtroDificuldade || filtroEquipamento) && (
            <div className="treinamento-acoes-linha">
              <button
                type="button"
                onClick={limparFiltros}
                className="treinamento-btn treinamento-btn--neutro"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="form-card">
        <div className="treinamento-tabela-header">
          <h3>Catálogo de Exercícios</h3>
          <span>
            {exerciciosFiltrados.length} {exerciciosFiltrados.length === 1 ? 'exercício' : 'exercícios'}
          </span>
        </div>

        {carregando ? (
          <div>Carregando exercícios...</div>
        ) : exerciciosPaginados.length === 0 ? (
          <div>Nenhum exercício encontrado com os filtros selecionados.</div>
        ) : (
          <div className="treinamento-tabela-wrap">
            <table className="treinamento-tabela">
              <thead>
                <tr>
                  <th>Exercício</th>
                  <th>Músculos</th>
                  <th>Equipamento</th>
                  <th>Dificuldade</th>
                  <th>Mídia</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {exerciciosPaginados.map((ex) => {
                  const principais = ex.grupos_principais || [];
                  const secundarios = ex.grupos_secundarios || [];
                  const ehGlobal = ehExercicioGlobal(ex);
                  const podeEditar = ehGlobal ? ehAdminGlobal : Number(ex.academia_id) === academiaId;

                  return (
                    <tr key={ex.id}>
                      <td>
                        <strong>{ex.nome}</strong>
                        {ex.descricao && <div>{ex.descricao}</div>}
                        <span className={`treinamento-chip ${ehGlobal ? 'treinamento-chip--ativo-dourado' : 'treinamento-chip--ativo-teal'}`}>
                          {ehGlobal ? 'Biblioteca do Sistema' : 'Minha Academia'}
                        </span>
                      </td>

                      <td>
                        {principais.length > 0 && (
                          <div>
                            <strong>Principal: </strong>
                            <span>{principais.map((g) => g.nome).join(', ')}</span>
                          </div>
                        )}
                        {secundarios.length > 0 && (
                          <div>
                            <strong>Secundário: </strong>
                            <span>{secundarios.map((g) => g.nome).join(', ')}</span>
                          </div>
                        )}
                        {principais.length === 0 && secundarios.length === 0 && <span>—</span>}
                      </td>

                      <td>{ex.equipamento || 'Livre / Peso corporal'}</td>

                      <td>
                        <span className="treinamento-badge treinamento-badge--neutro">
                          {obterRotuloDificuldade(ex.dificuldade)}
                        </span>
                      </td>

                      <td>
                        <div className="treinamento-acoes-linha">
                          {ex.imagem_url && <button type="button" onClick={() => setDetalheExercicio(ex)} className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm">Imagem</button>}
                          {ex.video_url && <button type="button" onClick={() => setDetalheExercicio(ex)} className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm">Vídeo</button>}
                          {!ex.imagem_url && !ex.video_url && <span>—</span>}
                        </div>
                      </td>

                      <td>
                        <div className="treinamento-acoes-linha">
                          <button type="button" onClick={() => setDetalheExercicio(ex)} className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm">Visualizar</button>
                          {podeEditar && <>
                            <button type="button" disabled={!podeAcessar(usuarioAtual,'exercicios','editar')} onClick={() => abrirEditarModal(ex)} className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm">Editar</button>
                            <button type="button" disabled={!podeAcessar(usuarioAtual,'exercicios','excluir')} onClick={() => handleExcluir(ex)} className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm">Excluir</button>
                          </>}
                          {ehGlobal && academiaId != null && academiaId > 0 && (
                            <button type="button" disabled={salvando} onClick={() => duplicarExercicio(ex)} className="treinamento-btn treinamento-btn--suave-azul treinamento-btn--sm">Duplicar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {modalAberto && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card">
            <div className="treinamento-modal-header">
              <h3>{editandoExercicio ? 'Editar Exercício' : 'Novo Exercício'}</h3>
              <button
                type="button"
                onClick={fecharModal}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            <form onSubmit={handleSalvar} className="treinamento-grid-auto">
              <div className="treinamento-campo">
                <label htmlFor="nome-ex">Nome do Exercício *</label>
                <input
                  id="nome-ex"
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Supino Reto com Barra"
                  required
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="eq-ex">Equipamento</label>
                <input
                  id="eq-ex"
                  type="text"
                  value={form.equipamento}
                  onChange={(e) => setForm({ ...form, equipamento: e.target.value })}
                  placeholder="Ex: Barra, Halteres, Polia, Máquina..."
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="dif-ex">Dificuldade</label>
                <select
                  id="dif-ex"
                  value={form.dificuldade}
                  onChange={(e) => setForm({ ...form, dificuldade: e.target.value })}
                >
                  {niveisDificuldade.length === 0 ? (
                    <>
                      <option value="iniciante">Iniciante</option>
                      <option value="intermediario">Intermediário</option>
                      <option value="avancado">Avançado</option>
                    </>
                  ) : (
                    niveisDificuldade.map((n) => (
                      <option key={n.id} value={n.slug}>
                        {n.nome}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="treinamento-campo">
                <label>
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  />{' '}
                  Exercício ativo na biblioteca
                </label>
              </div>

              <div className="treinamento-campo">
                <label htmlFor="img-ex">URL da Imagem</label>
                <input
                  id="img-ex"
                  type="url"
                  value={form.imagem_url}
                  onChange={(e) => setForm({ ...form, imagem_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="vid-ex">URL do Vídeo (execução)</label>
                <input
                  id="vid-ex"
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="treinamento-campo">
                <label>Grupos Musculares Principais</label>
                {grupos.length === 0 ? (
                  <span>Nenhum grupo muscular cadastrado ainda.</span>
                ) : (
                  <div className="treinamento-chips-wrap">
                    {grupos.map((g) => {
                      const marcado = form.grupos_principais.includes(Number(g.id));
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => alternarGrupo('grupos_principais', g.id)}
                          className={`treinamento-chip ${marcado ? 'treinamento-chip--ativo-azul' : ''}`}
                        >
                          {g.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="treinamento-campo">
                <label>Grupos Musculares Secundários</label>
                {grupos.length === 0 ? (
                  <span>Nenhum grupo muscular cadastrado ainda.</span>
                ) : (
                  <div className="treinamento-chips-wrap">
                    {grupos.map((g) => {
                      const marcado = form.grupos_secundarios.includes(Number(g.id));
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => alternarGrupo('grupos_secundarios', g.id)}
                          className={`treinamento-chip ${marcado ? 'treinamento-chip--ativo-teal' : ''}`}
                        >
                          {g.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="treinamento-campo">
                <label htmlFor="desc-ex">Descrição Resumida</label>
                <input
                  id="desc-ex"
                  type="text"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Visão geral do exercício..."
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="inst-ex">Instruções Técnicas de Execução</label>
                <textarea
                  id="inst-ex"
                  rows={3}
                  value={form.instrucoes}
                  onChange={(e) => setForm({ ...form, instrucoes: e.target.value })}
                  placeholder="Postura inicial, pegada, amplitude, cadência e respiração..."
                />
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
                  {salvando ? 'Salvando...' : 'Salvar Exercício'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalheExercicio && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card treinamento-modal-card--sm">
            <div className="treinamento-modal-header">
              <h3>{detalheExercicio.nome}</h3>
              <button
                type="button"
                onClick={() => setDetalheExercicio(null)}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {detalheExercicio.descricao && (
              <p style={{ marginTop: '0.5rem' }}>
                <strong>Descrição: </strong>
                {detalheExercicio.descricao}
              </p>
            )}

            {detalheExercicio.instrucoes && (
              <p style={{ marginTop: '0.5rem' }}>
                <strong>Instruções de Execução: </strong>
                {detalheExercicio.instrucoes}
              </p>
            )}

            {detalheExercicio.imagem_url && (
              <div style={{ marginTop: '1rem' }}>
                <img
                  src={detalheExercicio.imagem_url}
                  alt={detalheExercicio.nome}
                  style={{ maxWidth: '100%', borderRadius: '8px' }}
                />
              </div>
            )}

            {detalheExercicio.video_url && (
              <div style={{ marginTop: '1rem' }}>
                <a
                  href={detalheExercicio.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="treinamento-btn treinamento-btn--suave-verde"
                >
                  Abrir vídeo de referência →
                </a>
              </div>
            )}

            <div className="treinamento-modal-footer">
              <button
                type="button"
                onClick={() => setDetalheExercicio(null)}
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
