import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/treinamento.css';

const estadoInicialModalidade = {
  nome: '',
  descricao: '',
  ativo: true,
};

const estadoInicialNivel = {
  nome: '',
  slug: '',
  ordem: 1,
  ativo: true,
};

export default function ConfiguracoesTreino() {
  const [abaAtiva, setAbaAtiva] = useState('modalidades'); // 'modalidades' | 'niveis'

  // Dados
  const [modalidades, setModalidades] = useState([]);
  const [niveis, setNiveis] = useState([]);

  // Filtros
  const [buscaModalidade, setBuscaModalidade] = useState('');

  // Modais
  const [modalModAberto, setModalModAberto] = useState(false);
  const [editandoModalidade, setEditandoModalidade] = useState(null);
  const [formModalidade, setFormModalidade] = useState(estadoInicialModalidade);

  const [modalNivelAberto, setModalNivelAberto] = useState(false);
  const [editandoNivel, setEditandoNivel] = useState(null);
  const [formNivel, setFormNivel] = useState(estadoInicialNivel);

  // Estados gerais
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

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
      const [resMod, resNiv] = await Promise.all([
        api.get('/modalidades').catch(() => ({ data: [] })),
        api.get('/niveis-dificuldade').catch(() => ({ data: [] })),
      ]);

      const listaMod = Array.isArray(resMod.data) ? resMod.data : [];
      const listaNiv = Array.isArray(resNiv.data) ? resNiv.data : [];

      setModalidades(listaMod);
      setNiveis(listaNiv);
    } catch (err) {
      console.error(err);
      notificarErro('Erro ao carregar configurações de treinamento.');
    } finally {
      setCarregando(false);
    }
  };

  // --- MODALIDADES ---
  const modalidadesFiltradas = useMemo(() => {
    if (!buscaModalidade.trim()) return modalidades;
    const termo = buscaModalidade.trim().toLowerCase();
    return modalidades.filter(
      (m) =>
        String(m.nome || '').toLowerCase().includes(termo) ||
        String(m.descricao || '').toLowerCase().includes(termo)
    );
  }, [modalidades, buscaModalidade]);

  const abrirNovaModalidade = () => {
    setEditandoModalidade(null);
    setFormModalidade(estadoInicialModalidade);
    setErro('');
    setModalModAberto(true);
  };

  const abrirEditarModalidade = (mod) => {
    setEditandoModalidade(mod);
    setFormModalidade({
      nome: mod.nome || '',
      descricao: mod.descricao || '',
      ativo: mod.ativo !== 0 && mod.ativo !== false,
    });
    setErro('');
    setModalModAberto(true);
  };

  const fecharModalModalidade = () => {
    if (salvando) return;
    setModalModAberto(false);
    setEditandoModalidade(null);
    setFormModalidade(estadoInicialModalidade);
  };

  const handleSalvarModalidade = async (e) => {
    e.preventDefault();
    if (!formModalidade.nome.trim()) {
      setErro('Informe o nome da modalidade.');
      return;
    }

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: formModalidade.nome.trim(),
        descricao: formModalidade.descricao.trim() || null,
        ativo: formModalidade.ativo ? 1 : 0,
      };

      if (editandoModalidade) {
        await api.put(`/modalidades/${editandoModalidade.id}`, payload);
        notificarSucesso('Modalidade atualizada com sucesso!');
      } else {
        await api.post('/modalidades', payload);
        notificarSucesso('Modalidade cadastrada com sucesso!');
      }

      setModalModAberto(false);
      setEditandoModalidade(null);
      setFormModalidade(estadoInicialModalidade);
      await carregarDados();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao salvar modalidade.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivoModalidade = async (mod) => {
    setErro('');
    setSucesso('');
    try {
      const novoStatus = mod.ativo === 1 ? 0 : 1;
      await api.put(`/modalidades/${mod.id}`, {
        nome: mod.nome,
        descricao: mod.descricao,
        ativo: novoStatus,
      });
      notificarSucesso(`Modalidade "${mod.nome}" ${novoStatus ? 'ativada' : 'desativada'} com sucesso.`);
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao atualizar status da modalidade.');
    }
  };

  const handleExcluirModalidade = async (mod) => {
    if (!window.confirm(`Deseja realmente excluir a modalidade "${mod.nome}"?`)) return;
    setErro('');
    setSucesso('');
    try {
      await api.delete(`/modalidades/${mod.id}`);
      notificarSucesso(`Modalidade "${mod.nome}" excluída com sucesso!`);
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao excluir modalidade.');
    }
  };

  // --- NÍVEIS DE DIFICULDADE ---
  const abrirNovoNivel = () => {
    setEditandoNivel(null);
    setFormNivel({
      ...estadoInicialNivel,
      ordem: niveis.length + 1,
    });
    setErro('');
    setModalNivelAberto(true);
  };

  const abrirEditarNivel = (niv) => {
    setEditandoNivel(niv);
    setFormNivel({
      nome: niv.nome || '',
      slug: niv.slug || '',
      ordem: niv.ordem || 1,
      ativo: niv.ativo !== 0 && niv.ativo !== false,
    });
    setErro('');
    setModalNivelAberto(true);
  };

  const fecharModalNivel = () => {
    if (salvando) return;
    setModalNivelAberto(false);
    setEditandoNivel(null);
    setFormNivel(estadoInicialNivel);
  };

  const handleSalvarNivel = async (e) => {
    e.preventDefault();
    if (!formNivel.nome.trim()) {
      setErro('Informe o nome do nível de dificuldade.');
      return;
    }

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: formNivel.nome.trim(),
        slug: formNivel.slug.trim() || null,
        ordem: Number(formNivel.ordem || 1),
        ativo: formNivel.ativo ? 1 : 0,
      };

      if (editandoNivel) {
        await api.put(`/niveis-dificuldade/${editandoNivel.id}`, payload);
        notificarSucesso('Nível de dificuldade atualizado com sucesso!');
      } else {
        await api.post('/niveis-dificuldade', payload);
        notificarSucesso('Nível de dificuldade cadastrado com sucesso!');
      }

      setModalNivelAberto(false);
      setEditandoNivel(null);
      setFormNivel(estadoInicialNivel);
      await carregarDados();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao salvar nível de dificuldade.');
    } finally {
      setSalvando(false);
    }
  };

  const handleToggleAtivoNivel = async (niv) => {
    setErro('');
    setSucesso('');
    try {
      const novoStatus = niv.ativo === 1 ? 0 : 1;
      await api.put(`/niveis-dificuldade/${niv.id}`, {
        nome: niv.nome,
        slug: niv.slug,
        ordem: niv.ordem,
        ativo: novoStatus,
      });
      notificarSucesso(`Nível "${niv.nome}" ${novoStatus ? 'ativado' : 'desativado'} com sucesso.`);
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao alterar status do nível.');
    }
  };

  const handleExcluirNivel = async (niv) => {
    if (!window.confirm(`Deseja realmente excluir o nível de dificuldade "${niv.nome}"?`)) return;
    setErro('');
    setSucesso('');
    try {
      await api.delete(`/niveis-dificuldade/${niv.id}`);
      notificarSucesso(`Nível "${niv.nome}" excluído com sucesso!`);
      await carregarDados();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao excluir nível de dificuldade.');
    }
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Configurações de Treinamento</h2>
          <p>Gerenciamento de modalidades esportivas e níveis de dificuldade para treinos e modelos</p>
        </div>
        <div className="treinamento-acoes-header">
          {abaAtiva === 'modalidades' ? (
            <button
              type="button"
              onClick={abrirNovaModalidade}
              className="treinamento-btn treinamento-btn--primario"
            >
              + Nova Modalidade
            </button>
          ) : (
            <button
              type="button"
              onClick={abrirNovoNivel}
              className="treinamento-btn treinamento-btn--primario"
            >
              + Novo Nível
            </button>
          )}
          <Link to="/dashboard">← Voltar</Link>
        </div>
      </div>

      {erro && !modalModAberto && !modalNivelAberto && (
        <div role="alert" className="treinamento-alerta-erro">
          {erro}
        </div>
      )}

      {sucesso && (
        <div role="status" className="treinamento-alerta-sucesso">
          {sucesso}
        </div>
      )}

      {/* Seletor de Abas */}
      <div className="form-card" style={{ padding: '0.75rem', marginBottom: '1.25rem' }}>
        <div className="treinamento-acoes-linha" style={{ gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setAbaAtiva('modalidades')}
            className={`treinamento-btn ${
              abaAtiva === 'modalidades' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            🏋️ Modalidades ({modalidades.length})
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('niveis')}
            className={`treinamento-btn ${
              abaAtiva === 'niveis' ? 'treinamento-btn--escuro' : 'treinamento-btn--neutro'
            }`}
          >
            🎯 Níveis de Dificuldade ({niveis.length})
          </button>
        </div>
      </div>

      {/* ABA 1: MODALIDADES */}
      {abaAtiva === 'modalidades' && (
        <>
          <div className="treinamento-resumo-grid">
            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">TOTAL DE MODALIDADES</span>
              <div className="treinamento-stat-valor">{modalidades.length}</div>
            </div>

            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">MODALIDADES ATIVAS</span>
              <div className="treinamento-stat-valor treinamento-stat-valor--sucesso">
                {modalidades.filter((m) => m.ativo === 1).length}
              </div>
            </div>

            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">MODELOS VINCULADOS</span>
              <div className="treinamento-stat-valor treinamento-stat-valor--primario">
                {modalidades.reduce((acc, m) => acc + Number(m.total_modelos || 0), 0)}
              </div>
            </div>
          </div>

          <div className="form-card treinamento-filtro-card">
            <div className="treinamento-grid-auto">
              <div className="treinamento-campo">
                <label htmlFor="busca-mod">Pesquisar modalidade</label>
                <input
                  id="busca-mod"
                  type="text"
                  value={buscaModalidade}
                  onChange={(e) => setBuscaModalidade(e.target.value)}
                  placeholder="Nome ou descrição da modalidade..."
                />
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="treinamento-tabela-header">
              <h3>Modalidades Esportivas</h3>
              <span>
                {modalidadesFiltradas.length}{' '}
                {modalidadesFiltradas.length === 1 ? 'modalidade' : 'modalidades'}
              </span>
            </div>

            {carregando ? (
              <div>Carregando modalidades...</div>
            ) : modalidadesFiltradas.length === 0 ? (
              <div>Nenhuma modalidade encontrada.</div>
            ) : (
              <div className="treinamento-tabela-wrap">
                <table className="treinamento-tabela">
                  <thead>
                    <tr>
                      <th>Modalidade</th>
                      <th>Descrição</th>
                      <th>Modelos</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalidadesFiltradas.map((mod) => (
                      <tr key={mod.id}>
                        <td>
                          <strong>{mod.nome}</strong>
                        </td>
                        <td>{mod.descricao || '—'}</td>
                        <td>
                          <span className="treinamento-badge treinamento-badge--azul">
                            {Number(mod.total_modelos || 0)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`treinamento-badge ${
                              mod.ativo === 1 ? 'treinamento-badge--sucesso' : 'treinamento-badge--neutro'
                            }`}
                          >
                            {mod.ativo === 1 ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <div className="treinamento-acoes-linha">
                            <button
                              type="button"
                              onClick={() => abrirEditarModalidade(mod)}
                              className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAtivoModalidade(mod)}
                              className={`treinamento-btn ${
                                mod.ativo === 1
                                  ? 'treinamento-btn--suave-azul'
                                  : 'treinamento-btn--suave-verde'
                              } treinamento-btn--sm`}
                            >
                              {mod.ativo === 1 ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirModalidade(mod)}
                              className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ABA 2: NÍVEIS DE DIFICULDADE */}
      {abaAtiva === 'niveis' && (
        <>
          <div className="treinamento-resumo-grid">
            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">TOTAL DE NÍVEIS</span>
              <div className="treinamento-stat-valor">{niveis.length}</div>
            </div>

            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">NÍVEIS ATIVOS</span>
              <div className="treinamento-stat-valor treinamento-stat-valor--sucesso">
                {niveis.filter((n) => n.ativo === 1).length}
              </div>
            </div>

            <div className="form-card treinamento-stat-card">
              <span className="treinamento-stat-label">MODELOS VINCULADOS</span>
              <div className="treinamento-stat-valor treinamento-stat-valor--primario">
                {niveis.reduce((acc, n) => acc + Number(n.total_modelos || 0), 0)}
              </div>
            </div>
          </div>

          <div className="form-card">
            <div className="treinamento-tabela-header">
              <h3>Níveis de Dificuldade</h3>
              <span>{niveis.length} níveis configurados</span>
            </div>

            {carregando ? (
              <div>Carregando níveis de dificuldade...</div>
            ) : niveis.length === 0 ? (
              <div>Nenhum nível cadastrado.</div>
            ) : (
              <div className="treinamento-tabela-wrap">
                <table className="treinamento-tabela">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Ordem</th>
                      <th>Nível</th>
                      <th>Identificador (Slug)</th>
                      <th>Modelos</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {niveis.map((niv) => (
                      <tr key={niv.id}>
                        <td>
                          <strong>#{niv.ordem}</strong>
                        </td>
                        <td>
                          <strong>{niv.nome}</strong>
                        </td>
                        <td>
                          <code>{niv.slug}</code>
                        </td>
                        <td>
                          <span className="treinamento-badge treinamento-badge--azul">
                            {Number(niv.total_modelos || 0)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`treinamento-badge ${
                              niv.ativo === 1 ? 'treinamento-badge--sucesso' : 'treinamento-badge--neutro'
                            }`}
                          >
                            {niv.ativo === 1 ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>
                          <div className="treinamento-acoes-linha">
                            <button
                              type="button"
                              onClick={() => abrirEditarNivel(niv)}
                              className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAtivoNivel(niv)}
                              className={`treinamento-btn ${
                                niv.ativo === 1
                                  ? 'treinamento-btn--suave-azul'
                                  : 'treinamento-btn--suave-verde'
                              } treinamento-btn--sm`}
                            >
                              {niv.ativo === 1 ? 'Desativar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirNivel(niv)}
                              className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL MODALIDADE */}
      {modalModAberto && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card treinamento-modal-card--sm">
            <div className="treinamento-modal-header">
              <h3>{editandoModalidade ? 'Editar Modalidade' : 'Nova Modalidade'}</h3>
              <button
                type="button"
                onClick={fecharModalModalidade}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            <form onSubmit={handleSalvarModalidade} className="treinamento-grid-auto">
              <div className="treinamento-campo">
                <label htmlFor="nome-mod">Nome da Modalidade *</label>
                <input
                  id="nome-mod"
                  type="text"
                  value={formModalidade.nome}
                  onChange={(e) => setFormModalidade({ ...formModalidade, nome: e.target.value })}
                  placeholder="Ex: Musculação, Funcional, Cross Training..."
                  required
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="desc-mod">Descrição</label>
                <textarea
                  id="desc-mod"
                  rows={3}
                  value={formModalidade.descricao}
                  onChange={(e) => setFormModalidade({ ...formModalidade, descricao: e.target.value })}
                  placeholder="Objetivo e características da modalidade..."
                />
              </div>

              <div className="treinamento-campo">
                <label>
                  <input
                    type="checkbox"
                    checked={formModalidade.ativo}
                    onChange={(e) => setFormModalidade({ ...formModalidade, ativo: e.target.checked })}
                  />{' '}
                  Modalidade ativa para novos treinos
                </label>
              </div>

              <div className="treinamento-modal-footer">
                <button
                  type="button"
                  onClick={fecharModalModalidade}
                  className="treinamento-btn treinamento-btn--neutro"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="treinamento-btn treinamento-btn--escuro"
                >
                  {salvando ? 'Salvando...' : 'Salvar Modalidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NÍVEL DE DIFICULDADE */}
      {modalNivelAberto && (
        <div role="dialog" aria-modal="true" className="treinamento-modal-backdrop">
          <div className="form-card treinamento-modal-card treinamento-modal-card--sm">
            <div className="treinamento-modal-header">
              <h3>{editandoNivel ? 'Editar Nível de Dificuldade' : 'Novo Nível de Dificuldade'}</h3>
              <button
                type="button"
                onClick={fecharModalNivel}
                className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              >
                ✕
              </button>
            </div>

            {erro && <div className="treinamento-alerta-erro">{erro}</div>}

            <form onSubmit={handleSalvarNivel} className="treinamento-grid-auto">
              <div className="treinamento-campo">
                <label htmlFor="nome-niv">Nome do Nível *</label>
                <input
                  id="nome-niv"
                  type="text"
                  value={formNivel.nome}
                  onChange={(e) => setFormNivel({ ...formNivel, nome: e.target.value })}
                  placeholder="Ex: Iniciante, Intermediário, Avançado..."
                  required
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="slug-niv">Identificador (Slug)</label>
                <input
                  id="slug-niv"
                  type="text"
                  value={formNivel.slug}
                  onChange={(e) => setFormNivel({ ...formNivel, slug: e.target.value })}
                  placeholder="Ex: iniciante, intermediario (gerado auto se vazio)"
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="ordem-niv">Ordem de Exibição</label>
                <input
                  id="ordem-niv"
                  type="number"
                  min="1"
                  max="100"
                  value={formNivel.ordem}
                  onChange={(e) => setFormNivel({ ...formNivel, ordem: e.target.value })}
                  required
                />
              </div>

              <div className="treinamento-campo">
                <label>
                  <input
                    type="checkbox"
                    checked={formNivel.ativo}
                    onChange={(e) => setFormNivel({ ...formNivel, ativo: e.target.checked })}
                  />{' '}
                  Nível ativo para novos modelos
                </label>
              </div>

              <div className="treinamento-modal-footer">
                <button
                  type="button"
                  onClick={fecharModalNivel}
                  className="treinamento-btn treinamento-btn--neutro"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="treinamento-btn treinamento-btn--escuro"
                >
                  {salvando ? 'Salvando...' : 'Salvar Nível'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
