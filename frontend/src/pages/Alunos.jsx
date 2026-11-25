import { useAuth } from '../contexts/AuthContext';
import { podeAcessar } from '../permissoesProfessor';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/aluno.css';
import '../styles/treinamento.css';

const alunoInicial = {
  nome: '',
  cpf: '',
  telefone: '',
  email: '',
  data_nascimento: '',
  status: 'ativo',
  contato_emergencia: '',
  anamnese: '',
};

const somenteNumeros = (valor) =>
  String(valor || '').replace(/\D/g, '');

const normalizarTexto = (valor) =>
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export default function Alunos() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const formularioRef = useRef(null);

  const [alunos, setAlunos] = useState([]);
  const [aluno, setAluno] = useState(alunoInicial);
  const [editingId, setEditingId] = useState(null);
  const acaoAluno = editingId ? 'editar' : 'criar';
  const editarSaude = podeAcessar(usuario,'saude','visualizar') && podeAcessar(usuario,'saude',acaoAluno);
  const editarModelos = podeAcessar(usuario,'modelos','visualizar') && podeAcessar(usuario,'modelos',acaoAluno);

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [formAberto, setFormAberto] = useState(false);

  const [buscaAluno, setBuscaAluno] = useState('');
  const [filtroStatusAluno, setFiltroStatusAluno] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  // Modelos de treinamento
  const [modelosDisponiveis, setModelosDisponiveis] = useState([]);
  const [modalidades, setModalidades] = useState([]);
  const [niveis, setNiveis] = useState([]);
  const [selectedModelosIds, setSelectedModelosIds] = useState([]);

  const [filtroModalidade, setFiltroModalidade] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [buscaModelo, setBuscaModelo] = useState('');

  useEffect(() => {
    carregarAlunos();
    carregarAuxiliares();
  }, []);

  const carregarAlunos = async () => {
    setCarregandoLista(true);

    try {
      const res = await api.get('/alunos');
      const dados = Array.isArray(res.data)
        ? res.data
        : res.data?.alunos || [];

      setAlunos(Array.isArray(dados) ? dados : []);
    } catch (err) {
      setErro(
        err.response?.data?.mensagem ||
        'Erro ao carregar alunos.'
      );
    } finally {
      setCarregandoLista(false);
    }
  };

  const carregarAuxiliares = async () => {
    try {
      const [resModelos, resMod, resNiv] = await Promise.all([
        api.get('/modelos-treino').catch(() => ({ data: [] })),
        api.get('/modalidades').catch(() => ({ data: [] })),
        api.get('/niveis-dificuldade').catch(() => ({ data: [] })),
      ]);

      const rawModelos = Array.isArray(resModelos.data)
        ? resModelos.data
        : resModelos.data?.modelos || [];

      setModelosDisponiveis(
        rawModelos.filter(
          (m) =>
            m.ativo !== 0 &&
            m.ativo !== false &&
            m.status !== 'inativo'
        )
      );

      setModalidades(
        Array.isArray(resMod.data)
          ? resMod.data
          : resMod.data?.modalidades || []
      );

      setNiveis(
        Array.isArray(resNiv.data)
          ? resNiv.data
          : resNiv.data?.niveis || []
      );
    } catch (err) {
      console.error('Erro ao carregar dados de treinamento:', err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedModelosIds([]);
    setAluno({ ...alunoInicial });
    setFiltroModalidade('');
    setFiltroNivel('');
    setBuscaModelo('');
  };

  const abrirNovoAluno = () => {
    resetForm();
    setErro('');
    setSucesso('');
    setFormAberto(true);

    setTimeout(() => {
      formularioRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  const fecharFormulario = () => {
    resetForm();
    setFormAberto(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setAluno((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  };

  const toggleModelo = (modeloId) => {
    setSelectedModelosIds((prev) =>
      prev.includes(modeloId)
        ? prev.filter((id) => id !== modeloId)
        : [...prev, modeloId]
    );
  };

  const removerModeloSelecionado = (modeloId) => {
    setSelectedModelosIds((prev) =>
      prev.filter((id) => id !== modeloId)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!aluno.nome.trim()) {
      setErro('Informe o nome completo do aluno.');
      return;
    }

    setErro('');
    setSucesso('');
    setCarregando(true);

    const payload = {
      ...aluno,
      nome: aluno.nome.trim(),
      ...(editarModelos && { modelos_ids: selectedModelosIds }),
    };

    if (!editarSaude) {
      delete payload.anamnese;
      delete payload.contato_emergencia;
    }
    try {
      if (editingId) {
        await api.put(`/alunos/${editingId}`, payload);
        setSucesso(
          'Aluno e modelos de treinamento atualizados com sucesso!'
        );
      } else {
        await api.post('/alunos', payload);
        setSucesso(
          'Aluno cadastrado e modelos atribuídos com sucesso!'
        );
      }

      await carregarAlunos();
      fecharFormulario();
    } catch (err) {
      setErro(
        err.response?.data?.mensagem ||
        err.response?.data?.erro ||
        'Erro ao salvar aluno.'
      );
    } finally {
      setCarregando(false);
    }
  };

  const editar = async (a) => {
    setErro('');
    setSucesso('');

    setAluno({
      nome: a.nome || '',
      cpf: a.cpf || '',
      telefone: a.telefone || '',
      email: a.email || '',
      data_nascimento: a.data_nascimento
        ? String(a.data_nascimento).split('T')[0]
        : '',
      status: a.status || 'ativo',
      contato_emergencia: a.contato_emergencia || '',
      anamnese: a.anamnese || '',
    });

    setEditingId(a.id);
    setSelectedModelosIds([]);
    setFormAberto(true);

    try {
      const res = await api.get(
        `/alunos/${a.id}/modelos-treino`
      );

      const modelosAluno = Array.isArray(res.data)
        ? res.data
        : res.data?.modelos || [];

      setSelectedModelosIds(
        modelosAluno.map((m) => m.id)
      );
    } catch {
      setSelectedModelosIds([]);
    }

    setTimeout(() => {
      formularioRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  };

  const excluir = async (id) => {
    if (
      !window.confirm(
        'Deseja realmente excluir este aluno?'
      )
    ) {
      return;
    }

    setErro('');
    setSucesso('');

    try {
      await api.delete(`/alunos/${id}`);

      await carregarAlunos();

      if (editingId === id) {
        fecharFormulario();
      }

      setSucesso('Aluno excluído com sucesso.');
    } catch (err) {
      setErro(
        err.response?.data?.mensagem ||
        'Erro ao excluir aluno.'
      );
    }
  };

  // Pesquisa por nome ou CPF, inclusive sem pontuação
  const alunosFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaAluno);
    const termoNumerico = somenteNumeros(buscaAluno);

    return alunos
      .filter((a) => {
        const nome = normalizarTexto(a.nome);
        const cpf = somenteNumeros(a.cpf);

        const correspondeBusca =
          !termo ||
          nome.includes(termo) ||
          (
            termoNumerico.length > 0 &&
            cpf.includes(termoNumerico)
          );

        const correspondeStatus =
          filtroStatusAluno === 'todos' ||
          a.status === filtroStatusAluno;

        return correspondeBusca && correspondeStatus;
      })
      .sort((a, b) =>
        String(a.nome || '').localeCompare(
          String(b.nome || ''),
          'pt-BR'
        )
      );
  }, [alunos, buscaAluno, filtroStatusAluno]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(alunosFiltrados.length / porPagina)
  );

  const paginaAtual = Math.min(pagina, totalPaginas);

  const alunosPaginados = alunosFiltrados.slice(
    (paginaAtual - 1) * porPagina,
    paginaAtual * porPagina
  );

  const inicioExibicao = alunosFiltrados.length
    ? (paginaAtual - 1) * porPagina + 1
    : 0;

  const fimExibicao = Math.min(
    paginaAtual * porPagina,
    alunosFiltrados.length
  );

  const totalAtivos = alunos.filter(
    (a) => a.status === 'ativo'
  ).length;

  const totalInativos = alunos.filter(
    (a) => a.status === 'inativo'
  ).length;

  const totalInadimplentes = alunos.filter(
    (a) => a.status === 'inadimplente'
  ).length;

  const modelosFiltrados = useMemo(() => {
    return modelosDisponiveis.filter((m) => {
      if (
        filtroModalidade &&
        String(m.modalidade_id) !== String(filtroModalidade)
      ) {
        return false;
      }

      if (
        filtroNivel &&
        String(m.nivel_id) !== String(filtroNivel)
      ) {
        return false;
      }

      if (buscaModelo.trim()) {
        const termo = normalizarTexto(buscaModelo);

        const corresponde =
          normalizarTexto(m.nome).includes(termo) ||
          normalizarTexto(m.descricao).includes(termo) ||
          normalizarTexto(m.objetivo).includes(termo);

        if (!corresponde) return false;
      }

      return true;
    });
  }, [
    modelosDisponiveis,
    filtroModalidade,
    filtroNivel,
    buscaModelo,
  ]);

  const modelosSelecionadosObjetos = useMemo(() => {
    return selectedModelosIds
      .map((id) =>
        modelosDisponiveis.find(
          (m) => String(m.id) === String(id)
        )
      )
      .filter(Boolean);
  }, [selectedModelosIds, modelosDisponiveis]);

  return (
    <div className="page-container alunos-page">
      <div className="page-header alunos-page-header">
        <div>
          <h2>Gestão de Alunos</h2>
          <p>
            Cadastros, acompanhamento e modelos de treinamento
          </p>
        </div>

        <Link to="/dashboard" className="btn-voltar">
          ← Voltar
        </Link>
      </div>

      {erro && (
        <div className="msg-erro" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="msg-sucesso" role="status">
          {sucesso}
        </div>
      )}

      {/* Painel principal */}
      <section className="alunos-painel">
        <div className="alunos-topo">
          <div>
            <h3>Alunos Cadastrados</h3>
            <p>
              Encontre rapidamente um aluno ou gerencie
              seus dados.
            </p>
          </div>

          <button
            type="button"
            className="btn-salvar alunos-btn-novo"
            onClick={abrirNovoAluno} disabled={!podeAcessar(usuario,'alunos','criar')}
          >
            + Novo Aluno
          </button>
        </div>

        {/* Indicadores */}
        <div className="alunos-indicadores">
          <div className="alunos-indicador">
            <span>Total de alunos</span>
            <strong>{alunos.length}</strong>
            <small>Cadastros encontrados</small>
          </div>

          <div className="alunos-indicador alunos-indicador--ativo">
            <span>Alunos ativos</span>
            <strong>{totalAtivos}</strong>
            <small>Com status ativo</small>
          </div>

          <div className="alunos-indicador alunos-indicador--inativo">
            <span>Alunos inativos</span>
            <strong>{totalInativos}</strong>
            <small>Com status inativo</small>
          </div>

          <div className="alunos-indicador alunos-indicador--alerta">
            <span>Inadimplentes</span>
            <strong>{totalInadimplentes}</strong>
            <small>Com status inadimplente</small>
          </div>
        </div>

        {/* Pesquisa e filtros */}
        <div className="alunos-filtros">
          <div className="alunos-busca">
            <label htmlFor="busca-aluno">
              Pesquisar aluno
            </label>

            <input
              id="busca-aluno"
              type="search"
              placeholder="Digite o nome ou CPF..."
              value={buscaAluno}
              onChange={(e) => {
                setBuscaAluno(e.target.value);
                setPagina(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="filtro-status-aluno">
              Situação
            </label>

            <select
              id="filtro-status-aluno"
              value={filtroStatusAluno}
              onChange={(e) => {
                setFiltroStatusAluno(e.target.value);
                setPagina(1);
              }}
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
              <option value="inadimplente">
                Inadimplentes
              </option>
            </select>
          </div>

          <div>
            <label htmlFor="alunos-por-pagina">
              Exibir
            </label>

            <select
              id="alunos-por-pagina"
              value={porPagina}
              onChange={(e) => {
                setPorPagina(Number(e.target.value));
                setPagina(1);
              }}
            >
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
            </select>
          </div>
        </div>

        <div className="alunos-lista-info">
          <span>
            {carregandoLista
              ? 'Carregando alunos...'
              : `${alunosFiltrados.length} aluno(s) encontrado(s)`}
          </span>

          {(buscaAluno || filtroStatusAluno !== 'todos') && (
            <button
              type="button"
              className="alunos-limpar"
              onClick={() => {
                setBuscaAluno('');
                setFiltroStatusAluno('todos');
                setPagina(1);
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Listagem */}
        {carregandoLista ? (
          <div className="alunos-estado-vazio">
            Carregando alunos...
          </div>
        ) : alunosFiltrados.length === 0 ? (
          <div className="alunos-estado-vazio">
            <div className="alunos-vazio-icone">⌕</div>
            <strong>Nenhum aluno encontrado</strong>
            <p>
              Tente outro nome, CPF ou altere os filtros.
            </p>
          </div>
        ) : (
          <div className="alunos-tabela-scroll">
            <table className="tabela alunos-tabela">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>CPF</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {alunosPaginados.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button
                        type="button"
                        className="alunos-link-nome"
                        onClick={() =>
                          navigate(`/alunos/${a.id}`)
                        }
                        title="Abrir ficha do aluno"
                      >
                        {a.nome}
                      </button>
                    </td>

                    <td>{a.cpf || '—'}</td>

                    <td>
                      <span
                        className={`badge badge-${a.status}`}
                      >
                        {a.status || 'Não informado'}
                      </span>
                    </td>

                    <td>
                      <div className="alunos-acoes">
                        <button
                          type="button"
                          className="alunos-acao-ficha"
                          onClick={() =>
                            navigate(`/alunos/${a.id}`)
                          }
                        >
                          Ficha & Treinos
                        </button>

                        <button
                          type="button"
                          onClick={() => editar(a)} disabled={!podeAcessar(usuario,'alunos','editar')}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="alunos-acao-excluir"
                          onClick={() => excluir(a.id)} disabled={usuario?.cargo !== 'admin'}
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

        {/* Paginação */}
        {alunosFiltrados.length > 0 && (
          <div className="alunos-rodape-lista">
            <span>
              Exibindo {inicioExibicao}–{fimExibicao} de{' '}
              {alunosFiltrados.length}
            </span>

            <div className="alunos-paginacao">
              <button
                type="button"
                disabled={paginaAtual === 1}
                onClick={() =>
                  setPagina(paginaAtual - 1)
                }
              >
                ← Anterior
              </button>

              <span>
                Página {paginaAtual} de {totalPaginas}
              </span>

              <button
                type="button"
                disabled={paginaAtual >= totalPaginas}
                onClick={() =>
                  setPagina(paginaAtual + 1)
                }
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Formulário aparece somente quando solicitado */}
      {formAberto && (
        <section
          ref={formularioRef}
          className="form-card alunos-formulario"
          id="formulario-aluno"
        >
          <div className="alunos-form-titulo">
            <div>
              <h3>
                {editingId
                  ? 'Editar Aluno'
                  : 'Cadastrar Novo Aluno'}
              </h3>

              <p>
                Preencha os dados e escolha os modelos
                de treinamento.
              </p>
            </div>

            <button
              type="button"
              className="btn-outline"
              onClick={fecharFormulario}
              disabled={carregando}
            >
              ✕ Fechar
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="form-grid"
          >
            <div className="campo">
              <label htmlFor="aluno-nome">
                Nome Completo *
              </label>
              <input
                id="aluno-nome"
                name="nome"
                type="text"
                value={aluno.nome}
                onChange={handleChange}
                required
              />
            </div>

            <div className="campo">
              <label htmlFor="aluno-cpf">CPF</label>
              <input
                id="aluno-cpf"
                name="cpf"
                type="text"
                value={aluno.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="campo">
              <label htmlFor="aluno-telefone">
                Telefone / WhatsApp
              </label>
              <input
                id="aluno-telefone"
                name="telefone"
                type="tel"
                value={aluno.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="campo">
              <label htmlFor="aluno-email">E-mail</label>
              <input
                id="aluno-email"
                name="email"
                type="email"
                value={aluno.email}
                onChange={handleChange}
                placeholder="aluno@email.com"
              />
            </div>

            <div className="campo">
              <label htmlFor="aluno-nascimento">
                Data de Nascimento
              </label>
              <input
                id="aluno-nascimento"
                name="data_nascimento"
                type="date"
                value={aluno.data_nascimento}
                onChange={handleChange}
              />
            </div>

            <div className="campo">
              <label htmlFor="aluno-status">Status</label>
              <select
                id="aluno-status"
                name="status"
                value={aluno.status}
                onChange={handleChange}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="inadimplente">
                  Inadimplente
                </option>
              </select>
            </div>

            <div className="campo-full">
              <label htmlFor="aluno-emergencia">
                Contato de Emergência
              </label>
              <input
                id="aluno-emergencia" disabled={!editarSaude}
                name="contato_emergencia"
                type="text"
                value={podeAcessar(usuario,'saude','visualizar') ? aluno.contato_emergencia : ''}
                onChange={handleChange}
                placeholder="Nome e telefone do responsável"
              />
            </div>

            <div className="campo-full">
              <label htmlFor="aluno-anamnese">
                Anamnese e Observações de Saúde
              </label>
              <textarea
                id="aluno-anamnese" disabled={!editarSaude}
                name="anamnese"
                rows={4}
                value={podeAcessar(usuario,'saude','visualizar') ? aluno.anamnese : ''}
                onChange={handleChange}
                placeholder="Histórico médico, restrições, medicamentos..."
              />
            </div>

            {/* Modelos de treinamento */}
            <div className="campo-full aluno-modelos-secao">
              <div className="aluno-modelos-header">
                <div>
                  <h4>
                    🏋️ Atribuição de Modelos de Treinamento
                  </h4>

                  <p>
                    Selecione um ou vários modelos
                    compartilhados. As divisões e exercícios
                    serão atualizados em tempo real.
                  </p>
                </div>

                <span className="treinamento-badge treinamento-badge--azul">
                  {selectedModelosIds.length} modelo(s)
                  selecionado(s)
                </span>
              </div>

              {modelosSelecionadosObjetos.length > 0 && (
                <div className="aluno-modelos-vinculados-box">
                  <div className="aluno-modelos-vinculados-titulo">
                    Modelos selecionados
                  </div>

                  <div className="aluno-modelos-grid">
                    {modelosSelecionadosObjetos.map((m) => (
                      <div
                        key={m.id}
                        className="aluno-modelo-selecionado-card"
                      >
                        <div className="aluno-modelo-selecionado-info">
                          <div className="aluno-modelo-nome">
                            {m.nome}
                          </div>

                          <div className="aluno-modelo-meta">
                            {m.modalidade_nome || 'Geral'} •{' '}
                            {m.nivel_nome || 'Intermediário'} •{' '}
                            {m.divisoes?.length || 0} divisão(ões)
                          </div>
                        </div>

                        <button
                          type="button"
                          className="treinamento-btn treinamento-btn--perigo treinamento-btn--sm"
                          onClick={() =>
                            removerModeloSelecionado(m.id)
                          }
                          title="Remover modelo"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="aluno-modelos-filtros">
                <div className="campo">
                  <label htmlFor="modelo-modalidade">
                    Filtrar Modalidade
                  </label>

                  <select
                    id="modelo-modalidade"
                    value={filtroModalidade}
                    onChange={(e) =>
                      setFiltroModalidade(e.target.value)
                    }
                  >
                    <option value="">
                      Todas as modalidades
                    </option>

                    {modalidades.map((mod) => (
                      <option key={mod.id} value={mod.id}>
                        {mod.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="modelo-nivel">
                    Filtrar Nível
                  </label>

                  <select
                    id="modelo-nivel"
                    value={filtroNivel}
                    onChange={(e) =>
                      setFiltroNivel(e.target.value)
                    }
                  >
                    <option value="">
                      Todos os níveis
                    </option>

                    {niveis.map((niv) => (
                      <option key={niv.id} value={niv.id}>
                        {niv.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="modelo-busca">
                    Pesquisar Modelos
                  </label>

                  <input
                    id="modelo-busca"
                    type="search"
                    placeholder="Nome ou objetivo..."
                    value={buscaModelo}
                    onChange={(e) =>
                      setBuscaModelo(e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="aluno-modelos-lista-box">
                {modelosFiltrados.length === 0 ? (
                  <div className="aluno-modelos-dica">
                    Nenhum modelo de treino encontrado.
                  </div>
                ) : (
                  <div className="aluno-modelos-grid">
                    {modelosFiltrados.map((m) => {
                      const jaSelecionado =
                        selectedModelosIds.includes(m.id);

                      return (
                        <label
                          key={m.id}
                          className={`aluno-modelo-opcao-card ${
                            jaSelecionado ? 'ativo' : ''
                          }`}
                        >
                          <div className="aluno-modelo-selecionado-info">
                            <div className="aluno-modelo-nome">
                              {m.nome}
                            </div>

                            <div className="aluno-modelo-meta">
                              {m.modalidade_nome || 'Geral'} •{' '}
                              {m.nivel_nome || 'Intermediário'}
                              {m.divisoes?.length > 0 &&
                                ` • ${m.divisoes.length} divs`}
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            checked={jaSelecionado}
                            onChange={() => toggleModelo(m.id)}
                            aria-label={`Selecionar modelo ${m.nome}`}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="aluno-modelos-dica">
                É possível cadastrar alunos sem modelos
                e atribuí-los posteriormente.
              </div>
            </div>

            <div className="btn-grupo">
              <button
                type="button"
                className="btn-outline"
                onClick={fecharFormulario}
                disabled={carregando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-salvar"
                disabled={carregando}
              >
                {carregando
                  ? 'Salvando...'
                  : editingId
                    ? 'Atualizar Aluno e Modelos'
                    : 'Cadastrar Aluno com Modelos'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
