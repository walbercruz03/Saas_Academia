import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/treinamento.css';

const ITENS_POR_PAGINA = 6;

const estadoInicialForm = {
  nome: '',
  descricao: '',
};

export default function GruposMusculares() {
  const [grupos, setGrupos] = useState([]);
  const [busca, setBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoGrupo, setEditandoGrupo] = useState(null);
  const [form, setForm] = useState(estadoInicialForm);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    carregarGrupos();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca]);

  const notificarSucesso = (msg) => {
    setErro('');
    setSucesso(msg);
  };

  const notificarErro = (msg) => {
    setSucesso('');
    setErro(msg);
  };

  const carregarGrupos = async (termoBusca = busca) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await api.get('/grupos-musculares', {
        params: termoBusca ? { busca: termoBusca } : {},
      });
      const lista = Array.isArray(res.data) ? res.data : res.data?.grupos || [];
      setGrupos(lista);
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao carregar grupos musculares.');
    } finally {
      setCarregando(false);
    }
  };

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return grupos;
    return grupos.filter((g) => {
      const nome = String(g.nome || '').toLowerCase();
      const desc = String(g.descricao || '').toLowerCase();
      return nome.includes(termo) || desc.includes(termo);
    });
  }, [grupos, busca]);

  const totalPaginas = Math.max(1, Math.ceil(gruposFiltrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const gruposPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return gruposFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [gruposFiltrados, paginaSegura]);

  const resumo = useMemo(() => {
    const totalGrupos = grupos.length;
    const totalPrincipais = grupos.reduce((acc, g) => acc + Number(g.total_principais || 0), 0);
    const totalSecundarios = grupos.reduce((acc, g) => acc + Number(g.total_secundarios || 0), 0);
    return { totalGrupos, totalPrincipais, totalSecundarios };
  }, [grupos]);

  const abrirNovoModal = () => {
    setEditandoGrupo(null);
    setForm(estadoInicialForm);
    setErro('');
    setModalAberto(true);
  };

  const abrirEditarModal = (grupo) => {
    setEditandoGrupo(grupo);
    setForm({
      nome: grupo.nome || '',
      descricao: grupo.descricao || '',
    });
    setErro('');
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setEditandoGrupo(null);
    setForm(estadoInicialForm);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do grupo muscular.');
      return;
    }

    setSalvando(true);
    setErro('');
    setSucesso('');

    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
      };

      if (editandoGrupo) {
        await api.put(`/grupos-musculares/${editandoGrupo.id}`, payload);
        notificarSucesso('Grupo muscular atualizado com sucesso!');
      } else {
        await api.post('/grupos-musculares', payload);
        notificarSucesso('Grupo muscular cadastrado com sucesso!');
      }

      setModalAberto(false);
      setEditandoGrupo(null);
      setForm(estadoInicialForm);
      await carregarGrupos();
    } catch (err) {
      console.error(err);
      setErro(err?.response?.data?.erro || 'Erro ao salvar grupo muscular.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (grupo) => {
    if (!window.confirm(`Deseja realmente excluir o grupo muscular "${grupo.nome}"?`)) return;

    setErro('');
    setSucesso('');
    try {
      await api.delete(`/grupos-musculares/${grupo.id}`);
      notificarSucesso('Grupo muscular excluído com sucesso!');
      await carregarGrupos();
    } catch (err) {
      console.error(err);
      notificarErro(err?.response?.data?.erro || 'Erro ao excluir grupo muscular.');
    }
  };

  return (
    <div className="page-container treinamento-page">
      <div className="page-header">
        <div>
          <h2>Grupos Musculares</h2>
          <p>Cadastro e organização de grupos musculares, músculos principais e secundários</p>
        </div>
        <div className="treinamento-acoes-header">
          <button
            type="button"
            onClick={abrirNovoModal}
            className="treinamento-btn treinamento-btn--primario"
          >
            + Novo Grupo Muscular
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
          <span className="treinamento-stat-label">GRUPOS CADASTRADOS</span>
          <div className="treinamento-stat-valor">{resumo.totalGrupos}</div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">VÍNCULOS COMO MÚSCULO PRINCIPAL</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--primario">
            {resumo.totalPrincipais}
          </div>
        </div>

        <div className="form-card treinamento-stat-card">
          <span className="treinamento-stat-label">VÍNCULOS COMO MÚSCULO SECUNDÁRIO</span>
          <div className="treinamento-stat-valor treinamento-stat-valor--secundario">
            {resumo.totalSecundarios}
          </div>
        </div>
      </div>

      <div className="form-card treinamento-filtro-card">
        <div className="treinamento-grid-auto">
          <div className="treinamento-campo">
            <label htmlFor="busca-grupo">Pesquisar grupo muscular</label>
            <input
              id="busca-grupo"
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex: Peitoral, Costas, Quadríceps, Ombros..."
            />
          </div>

          <div className="treinamento-acoes-linha">
            <button
              type="button"
              onClick={() => carregarGrupos(busca)}
              className="treinamento-btn treinamento-btn--escuro"
            >
              Buscar
            </button>
            {busca && (
              <button
                type="button"
                onClick={() => {
                  setBusca('');
                  carregarGrupos('');
                }}
                className="treinamento-btn treinamento-btn--neutro"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="form-card">
        <div className="treinamento-tabela-header">
          <h3>Lista de Grupos Musculares</h3>
          <span>
            {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {carregando ? (
          <div>Carregando grupos musculares...</div>
        ) : gruposPaginados.length === 0 ? (
          <div>Nenhum grupo muscular encontrado.</div>
        ) : (
          <div className="treinamento-tabela-wrap">
            <table className="treinamento-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th>Principal</th>
                  <th>Secundário</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {gruposPaginados.map((grupo) => (
                  <tr key={grupo.id}>
                    <td>
                      <strong>{grupo.nome}</strong>
                    </td>
                    <td>{grupo.descricao || '—'}</td>
                    <td>
                      <span className="treinamento-badge treinamento-badge--azul">
                        {Number(grupo.total_principais || 0)}
                      </span>
                    </td>
                    <td>
                      <span className="treinamento-badge treinamento-badge--teal">
                        {Number(grupo.total_secundarios || 0)}
                      </span>
                    </td>
                    <td>
                      <div className="treinamento-acoes-linha">
                        <button
                          type="button"
                          onClick={() => abrirEditarModal(grupo)}
                          className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluir(grupo)}
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
          <div className="form-card treinamento-modal-card treinamento-modal-card--sm">
            <div className="treinamento-modal-header">
              <h3>{editandoGrupo ? 'Editar Grupo Muscular' : 'Novo Grupo Muscular'}</h3>
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
                <label htmlFor="nome-grupo">Nome do Grupo Muscular *</label>
                <input
                  id="nome-grupo"
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Peitoral, Dorsais, Quadríceps..."
                  required
                />
              </div>

              <div className="treinamento-campo">
                <label htmlFor="desc-grupo">Descrição</label>
                <textarea
                  id="desc-grupo"
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Observações anatômicas ou diretrizes de treino para este grupo..."
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
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}