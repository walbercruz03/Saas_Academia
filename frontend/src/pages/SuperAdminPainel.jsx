import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { solicitar } from '../apiSuperAdmin';
import NovaAcademia from '../components/NovaAcademia';
import AcademiaOperacional, { situacoesAcademia, acoesAcademia } from '../components/AcademiaOperacional';
import ConvitesAdministradores from '../components/ConvitesAdministradores';
import GestaoAdministrador, { rotulosGestao } from '../components/GestaoAdministrador';
import AssinaturasWcFit, { moedaComercial } from '../components/AssinaturasWcFit';
import '../styles/styles.css';
import '../styles/layout.css';
import '../styles/dashboard.css';
import '../styles/superAdmin.css';

const modulos = [
  { nome: 'Dashboard', icone: '📊', id: 'dashboard', descricao: 'Visão geral das academias e dos usuários do WC Fit.' },
  { nome: 'Academias', icone: '🏋️', id: 'academias', descricao: 'Consulte as academias cadastradas e sua situação operacional.' },
  { nome: 'Administradores', icone: '👥', id: 'administradores', descricao: 'Consulte as contas administrativas e seus vínculos com as academias.' },
  { nome: 'Assinaturas', icone: '📋', id: 'assinaturas', descricao: 'Gerencie assinaturas, preços, cortesias e recebimentos do WC Fit.' },
  { nome: 'Auditoria', icone: '🔒', id: 'auditoria', descricao: 'Consulte o histórico de segurança do Super Admin.' },
  { nome: 'Configurações', icone: '⚙️' },
];

const indicadores = [
  ['academias', 'Academias cadastradas'], ['ativas', 'Academias ativas'],
  ['inativas', 'Academias inativas'], ['administradores', 'Administradores vinculados'],
  ['professores', 'Professores vinculados'],
];
const comerciais = [
  ['testes', 'Academias em período experimental'], ['ativas', 'Assinaturas ativas'],
  ['inadimplentes', 'Assinaturas inadimplentes'], ['cortesias', 'Academias com cortesia'],
  ['cortesias_permanentes', 'Cortesias permanentes'], ['transicao', 'Academias em transição'],
  ['recorrente_centavos', 'Receita recorrente mensal'], ['recebido_mes_centavos', 'Receita recebida no mês'],
];

const eventos = {
  ...rotulosGestao,
  academia_operacao: 'Alteração operacional da academia',
  academia_criada: 'Academia cadastrada',
  academia_cadastro_consultado: 'Dados cadastrais consultados',
  academia_editada: 'Cadastro da academia editado',
  academia_excluida: 'Academia excluída',
  academia_excluida_definitivamente: 'Academia excluída definitivamente',
  comercial_assinatura: 'Teste gratuito iniciado',
  comercial_troca_meio: 'Forma de pagamento comercial alterada',
  comercial_preco: 'Preço comercial alterado',
  comercial_cortesia_concedida: 'Cortesia comercial concedida',
  comercial_cortesia_revogada: 'Cortesia comercial encerrada',
  comercial_recebimento: 'Recebimento comercial registrado',
  comercial_asaas_reserva: 'Operação Asaas Sandbox registrada',
  comercial_asaas_cancelamento: 'Encerramento de recorrência Sandbox solicitado',
  convite_emitido: 'Convite emitido',
  convite_reemitido: 'Convite reemitido',
  convite_ocultado: 'Convite removido da listagem',
  convite_revogado: 'Convite revogado',
  convite_aceito: 'Convite aceito',
  convite_conta_criada: 'Conta administrativa criada',
  convite_aceitacao_recusada: 'Aceitação de convite recusada',
  totp_reconfirmado: 'Segundo fator reconfirmado',
  proprietario_criado: 'Conta do proprietário criada',
  senha_validada: 'Senha validada',
  autenticacao_recusada: 'Autenticação recusada',
  acesso_administrativo_recusado: 'Acesso administrativo recusado',
  configuracao_totp_iniciada: 'Configuração do autenticador iniciada',
  totp_configurado: 'Autenticador configurado',
  totp_alterado: 'Autenticador alterado',
  totp_recusado: 'Código do autenticador recusado',
  autenticacao_concluida: 'Autenticação concluída',
  autenticacao_local_sem_totp: 'Login local com e-mail e senha',
  totp_configuracao_pendente_invalidada: 'Cadastro pendente do autenticador invalidado',
  recuperacao_recusada: 'Recuperação recusada',
  codigo_recuperacao_consumido: 'Código de recuperação utilizado',
  sessoes_revogadas_por_recuperacao: 'Sessões revogadas por recuperação',
  sessoes_revogadas: 'Sessões revogadas',
  sessao_encerrada: 'Sessão encerrada',
};

const dataFormato = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Fortaleza' });
const dataHoraFormato = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Fortaleza',
});
const formatarData = (valor, formato = dataFormato) => valor ? formato.format(new Date(valor)) : '—';

function Indicadores({ dados }) {
  return (
    <>
      <section aria-label="Indicadores administrativos" className="stats-grid">
        {indicadores.map(([id, rotulo]) => (
          <div className="stat-card" key={id}>
            <h3>{rotulo}</h3>
            <strong>{dados[id].toLocaleString('pt-BR')}</strong>
          </div>
        ))}
      </section>
      {dados.sandbox && <section aria-labelledby="sa-sandbox">
        <h2 id="sa-sandbox">Asaas Sandbox</h2>
        <div className="stats-grid">
          {[
            ['recorrencias','Recorrências vinculadas'], ['em_aberto','Cobranças em aberto'],
            ['vencidas','Cobranças vencidas'], ['com_manual','Competências com recebimento manual'],
            ['recebido_mes_centavos','Recebimentos simulados no mês'], ['estornado_centavos','Estornos simulados'],
            ['eventos_pendentes','Eventos pendentes de conciliação'],
          ].map(([campo,rotulo]) => <div className="stat-card" key={campo}>
            <h3>{rotulo}</h3><strong>{campo.endsWith('_centavos') ? moedaComercial(dados.sandbox[campo])
              : dados.sandbox[campo].toLocaleString('pt-BR')}</strong>
          </div>)}
        </div>
      </section>}
      <section aria-labelledby="sa-comercial">
        <h2 id="sa-comercial">Indicadores comerciais</h2>
        <div className="stats-grid">
          {comerciais.map(([campo, rotulo]) => (
            <div className="stat-card" key={campo}>
              <h3>{rotulo}</h3>
              {dados.comerciais ? <strong>{campo.endsWith('_centavos')
                ? moedaComercial(dados.comerciais[campo]) : dados.comerciais[campo].toLocaleString('pt-BR')}</strong>
                : <span>Módulo comercial indisponível</span>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const tabelas = {
  academias: ['Tabela de academias', 'Nenhuma academia encontrada.', ['ID', 'Academia', 'Situação', 'Cadastro', 'Administradores', 'Ações']],
  administradores: ['Tabela de administradores', 'Nenhum administrador encontrado.',
    ['ID', 'Nome', 'E-mail ou matrícula', 'Situação da conta', 'Academia vinculada', 'Ações']],
  auditoria: ['Eventos de auditoria', 'Nenhum evento de auditoria encontrado.', ['ID', 'Evento', 'Data e hora (Fortaleza)']],
};

const tiposCadastro = { mei: 'MEI', empresa: 'Empresa', pessoa_fisica: 'Pessoa física/autônomo' };
const filtrosAcademiaVazios = { documento: '', cidade: '', uf: '', tipo: '', excluidas: '' };

function Registros({ dados, modulo, mudarPagina, selecionarOperacao, selecionarAdministrador, selecionarCadastro }) {
  const [rotulo, vazio, colunas] = tabelas[modulo];
  if (!dados.registros.length && dados.pagina === 1 && modulo === 'auditoria') {
    return <p className="relatorio-vazio">{vazio}</p>;
  }

  return (
    <>
      {modulo !== 'auditoria' && <p>Total: {dados.total}</p>}
      {dados.registros.length ? (
        <div className="relatorio-tabela-wrapper sa-tabela" tabIndex={0}
          aria-label={rotulo} role="region">
          <table className="relatorio-tabela">
            <thead>
              <tr>{colunas.map((coluna) => (
                <th key={coluna} scope="col">{coluna}</th>
              ))}</tr>
            </thead>
            <tbody>
              {dados.registros.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.id}</td>
                  {modulo === 'academias' && (
                    <>
                      <th scope="row">
                        {linha.nome}
                        {linha.tipo_cadastro && <div>
                          <small>{[linha.cidade, linha.uf, tiposCadastro[linha.tipo_cadastro], linha.documento_mascarado].filter(Boolean).join(' · ')}</small>
                        </div>}
                      </th>
                      <td>{situacoesAcademia[linha.situacao_operacional]}</td>
                      <td>{formatarData(linha.criado_em)}</td>
                      <td><Link to={`/super-admin/administradores?academia=${linha.id}`}
                        aria-label={`Administradores de ${linha.nome}`}>{linha.administradores}</Link></td>
                      <td>
                        <div className="sa-acoes-academia">
                          {acoesAcademia[linha.situacao_operacional] && (
                            <button type="button" className="relatorios-btn relatorios-btn-secundario"
                              onClick={() => selecionarOperacao({ academia: linha, acao: acoesAcademia[linha.situacao_operacional][0] })}>
                              {acoesAcademia[linha.situacao_operacional][1]}
                            </button>
                          )}
                          <button type="button" className="relatorios-btn relatorios-btn-secundario"
                            onClick={() => selecionarCadastro({ academia: linha, acao: 'dados' })}>Visualizar dados</button>
                          {linha.situacao_operacional !== 'excluida' && <button type="button" className="relatorios-btn relatorios-btn-secundario"
                            onClick={() => selecionarCadastro({ academia: linha, acao: 'editar' })}>Editar cadastro</button>}
                          <Link className="relatorios-btn relatorios-btn-secundario"
                            to={`/super-admin/administradores?academia=${linha.id}`}>Gerenciar administradores</Link>
                          <Link className="relatorios-btn relatorios-btn-secundario"
                            to={`/super-admin/assinaturas?academia=${linha.id}`}>Gerenciar assinatura</Link>
                          <button type="button" className="relatorios-btn relatorios-btn-secundario"
                            onClick={() => selecionarOperacao({ academia: linha, acao: 'historico' })}>Histórico</button>
                          <button type="button" className="relatorios-btn relatorios-btn-secundario"
                            onClick={() => selecionarOperacao({ academia: linha, acao: linha.situacao_operacional === 'excluida' ? 'excluir-definitivamente' : 'excluir' })}>
                            {linha.situacao_operacional === 'excluida' ? 'Excluir definitivamente' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                  {modulo === 'administradores' && (
                    <>
                      <th scope="row">{linha.nome}</th>
                      <td>{linha.email_ou_matricula}</td>
                      <td>{linha.excluido ? 'Excluída' : linha.status === 'ativo' ? 'Ativa' : 'Inativa'}</td>
                      <td>{linha.academia_nome ? (
                        <>{linha.academia_nome} (#{linha.academia_id}){!linha.academia_ativa && ' · Inativa'}</>
                      ) : 'Sem academia vinculada'}</td>
                    </>
                  )}
                  {modulo === 'administradores' && <td>
                    <button type="button" className="relatorios-btn relatorios-btn-secundario"
                      onClick={() => selecionarAdministrador(linha)}>{linha.excluido ? 'Gerenciar conta excluída' : 'Gerenciar'}</button>
                  </td>}
                  {modulo === 'auditoria' && (
                    <>
                      <td>{eventos[linha.evento] || 'Outro evento de segurança'}{linha.academia_id && ` · Academia #${linha.academia_id}`}{linha.convite_id && ` · Convite #${linha.convite_id}`}</td>
                      <td>{formatarData(linha.criado_em, dataHoraFormato)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="relatorio-vazio">Nenhum registro nesta página.</p>}
      <nav className="sa-paginacao" aria-label="Paginação">
        <button type="button" className="relatorios-btn relatorios-btn-secundario" disabled={dados.pagina === 1}
          onClick={() => mudarPagina(dados.pagina - 1)}>Anterior</button>
        <span>Página {dados.pagina}</span>
        <button type="button" className="relatorios-btn relatorios-btn-secundario" disabled={!dados.temMais}
          onClick={() => mudarPagina(dados.pagina + 1)}>Próxima</button>
      </nav>
    </>
  );
}

export default function SuperAdminPainel() {
  const { modulo = 'dashboard' } = useParams();
  const [parametros, setParametros] = useSearchParams();
  const academiaAdmin = parametros.get('academia') || '';
  const buscaAdmin = parametros.get('busca') || '';
  const excluidosAdmin = parametros.get('excluidos') === '1';
  const navigate = useNavigate();
  const item = modulos.find((opcao) => opcao.id === modulo);
  const [sessao, setSessao] = useState(null);
  const [falhaSessao, setFalhaSessao] = useState('');
  const [menu, setMenu] = useState(false);
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [camposCadastro, setCamposCadastro] = useState(filtrosAcademiaVazios);
  const [filtro, setFiltro] = useState({ busca: '', situacao: '', ...filtrosAcademiaVazios });
  const [buscaComercial, setBuscaComercial] = useState('');
  const [paginacao, setPaginacao] = useState({ modulo: '', pagina: 1 });
  const [resultado, setResultado] = useState(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const [revalidacao, setRevalidacao] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [novaAcademia, setNovaAcademia] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [operacaoAcademia, setOperacaoAcademia] = useState(null);
  const [administradorSelecionado, setAdministradorSelecionado] = useState(null);
  const encerrarPorSessao = useCallback(() => navigate('/super-admin/login', {
    replace: true, state: { mensagem: 'Sua sessão expirou ou foi revogada. Entre novamente.' },
  }), [navigate]);

  useEffect(() => {
    const controle = new AbortController();
    let confirmada = false;
    let consultando = false;
    const verificar = async (evento) => {
      if (consultando) return;
      consultando = true;
      try {
        const dados = await solicitar('auth/sessao', null, controle.signal);
        if (controle.signal.aborted) return;
        if (confirmada && evento?.type === 'focus') setAtualizacao((valor) => valor + 1);
        confirmada = true;
        setSessao((anterior) => anterior?.expiraEm === dados.expiraEm ? anterior : dados);
      } catch (erro) {
        if (controle.signal.aborted) return;
        if (erro.status === 401) {
          navigate('/super-admin/login', {
            replace: true,
            state: confirmada ? { mensagem: 'Sua sessão expirou ou foi revogada. Entre novamente.' } : null,
          });
        } else {
          setSessao(null);
          setFalhaSessao(erro.message);
        }
      } finally {
        consultando = false;
      }
    };
    verificar();
    const timer = window.setInterval(verificar, 30000);
    window.addEventListener('focus', verificar);
    return () => {
      controle.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', verificar);
    };
  }, [navigate, revalidacao]);

  useEffect(() => {
    if (!sessao) return undefined;
    const expira = new Date(sessao.expiraEm).getTime();
    const expirar = () => navigate('/super-admin/login', {
      replace: true, state: { mensagem: 'Sua sessão administrativa expirou. Entre novamente.' },
    });
    const timer = window.setTimeout(expirar, Math.max(0, expira - Date.now()));
    return () => window.clearTimeout(timer);
  }, [sessao, navigate]);

  const pagina = paginacao.modulo === modulo ? paginacao.pagina : 1;
  const query = modulo === 'dashboard' ? '' : '?' + new URLSearchParams({
    pagina,
    ...(modulo === 'assinaturas' ? { busca: buscaComercial } : {}),
    ...(modulo === 'administradores' ? { busca: buscaAdmin, academia: academiaAdmin, excluidos: excluidosAdmin ? '1' : '0' } : {}),
  });
  const consulta = `${modulo}${query}`;

  useEffect(() => {
    if (!sessao || !item) return undefined;
    const controle = new AbortController();
    const requisicao = modulo === 'academias'
      ? solicitar('academias/filtrar', { ...filtro, pagina: String(pagina) }, controle.signal)
      : solicitar(consulta, null, controle.signal);
    requisicao.then((dados) => {
      if (!controle.signal.aborted) setResultado({ consulta, dados, atualizacao });
    }).catch((erro) => {
      if (controle.signal.aborted) return;
      if (erro.status === 401) {
        navigate('/super-admin/login', { replace: true, state: { mensagem: 'Sua sessão expirou ou foi revogada. Entre novamente.' } });
      } else setResultado({ consulta, erro: erro.message, atualizacao });
    });
    return () => controle.abort();
  }, [consulta, item, sessao, atualizacao, navigate, filtro, modulo, pagina]);

  async function sair(revogar = false) {
    setSaindo(true);
    setErroAcao('');
    try {
      await solicitar(revogar ? 'auth/revogar' : 'auth/logout', {});
      navigate('/super-admin/login', { replace: true });
    } catch (erro) {
      if (erro.status === 401) {
        navigate('/super-admin/login', { replace: true, state: { mensagem: 'Sua sessão expirou ou foi revogada. Entre novamente.' } });
      } else setErroAcao(erro.message);
    } finally {
      setSaindo(false);
    }
  }

  function atualizarCadastro(mensagem, manterAberto) {
    if (!manterAberto) setNovaAcademia(false);
    setConfirmacao(mensagem);
    setAtualizacao((valor) => valor + 1);
  }

  function aplicar(evento) {
    evento.preventDefault();
    setFiltro({ ...camposCadastro, busca: busca.trim(), situacao: camposCadastro.excluidas ? '' : situacao });
    setPaginacao({ modulo, pagina: 1 });
    setAtualizacao((valor) => valor + 1);
  }

  if (!sessao) {
    return (
      <main className="dashboard-container sa-inicio">
        <h1>Super Admin</h1>
        {falhaSessao ? (
          <>
            <p role="alert">{falhaSessao}</p>
            <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={() => {
              setFalhaSessao('');
              setRevalidacao((valor) => valor + 1);
            }}>Tentar novamente</button>
          </>
        ) : <p role="status">Verificando sessão…</p>}
      </main>
    );
  }

  if (!item) return <Navigate to="/super-admin" replace />;
  const atual = resultado?.consulta === consulta && resultado.atualizacao === atualizacao ? resultado : null;

  return (
    <div className="layout-app-container sa-painel">
      {menu && <button type="button" className="sa-fundo-menu" aria-label="Fechar menu" onClick={() => setMenu(false)} />}
      <aside id="sa-menu" className={`sidebar ${menu ? 'open' : ''}`}
        onKeyDown={(evento) => { if (evento.key === 'Escape') setMenu(false); }}>
        <div className="sidebar-header">
          <div className="logo-badge">WF</div>
          <div><h2>Wc Fit</h2><p>Super Admin</p></div>
        </div>
        <nav className="sidebar-nav" aria-label="Menu do Super Admin">
          <ul>
            {modulos.map(({ id, nome, icone }) => (
              <li key={nome}>
                {id ? (
                  <NavLink end to={id === 'dashboard' ? '/super-admin' : `/super-admin/${id}`} onClick={() => setMenu(false)}>
                    <span className="nav-icon" aria-hidden="true">{icone}</span>{nome}
                  </NavLink>
                ) : (
                  <span className="sa-menu-futuro" aria-disabled="true">
                    <span className="nav-icon" aria-hidden="true">{icone}</span>
                    <span>{nome}<small>Em breve</small></span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <button type="button" disabled={saindo} onClick={() => sair(false)}>🚪 Encerrar sessão</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="dashboard-container">
          <header className="page-header sa-cabecalho">
            <div>
              <button type="button" className="relatorios-btn relatorios-btn-secundario sa-abrir-menu"
                aria-controls="sa-menu" aria-expanded={menu} onClick={() => setMenu((aberto) => !aberto)}>Menu</button>
              <p>Wc Fit · Super Admin</p>
              <h1>{item.nome}</h1>
              <p>{item.descricao}</p>
            </div>
            <button type="button" className="relatorios-btn relatorios-btn-secundario" disabled={saindo}
              onClick={() => sair(true)}>Revogar todas as sessões</button>
          </header>
          {erroAcao && <p role="alert" className="relatorio-aviso-box">{erroAcao}</p>}
          {modulo === 'academias' && confirmacao && <p role="status" className="relatorio-aviso-box">{confirmacao}</p>}
          {modulo === 'academias' && (
            <form className="relatorios-controles sa-filtros" onSubmit={aplicar}>
              <label>Nome da academia
                <input className="relatorios-select" type="search" maxLength={120} value={busca}
                  onChange={(e) => setBusca(e.target.value)} />
              </label>
              <label>Situação operacional
                <select className="relatorios-select" disabled={Boolean(camposCadastro.excluidas)} value={situacao} onChange={(e) => setSituacao(e.target.value)}>
                  <option value="">Todas</option><option value="ativa">Ativas</option><option value="inativa">Inativas</option>
                </select>
              </label>
              <label>Listagem
                <select className="relatorios-select" value={camposCadastro.excluidas}
                  onChange={(e) => setCamposCadastro({ ...camposCadastro, excluidas: e.target.value })}>
                  <option value="">Academias cadastradas</option><option value="1">Somente excluídas</option>
                </select>
              </label>
              <label>CPF ou CNPJ
                <input className="relatorios-select" type="search" maxLength={18} value={camposCadastro.documento}
                  onChange={(e) => setCamposCadastro({ ...camposCadastro, documento: e.target.value })} />
              </label>
              <label>Cidade
                <input className="relatorios-select" type="search" maxLength={100} value={camposCadastro.cidade}
                  onChange={(e) => setCamposCadastro({ ...camposCadastro, cidade: e.target.value })} />
              </label>
              <label>UF
                <input className="relatorios-select" maxLength={2} value={camposCadastro.uf}
                  onChange={(e) => setCamposCadastro({ ...camposCadastro, uf: e.target.value.toUpperCase() })} />
              </label>
              <label>Tipo de cadastro
                <select className="relatorios-select" value={camposCadastro.tipo}
                  onChange={(e) => setCamposCadastro({ ...camposCadastro, tipo: e.target.value })}>
                  <option value="">Todos</option>
                  {Object.entries(tiposCadastro).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </select>
              </label>
              <button className="relatorios-btn relatorios-btn-primario" type="submit">Filtrar</button>
              <button className="relatorios-btn relatorios-btn-primario" type="button" onClick={() => {
                setConfirmacao('');
                setNovaAcademia(true);
              }}>Nova Academia</button>
            </form>
          )}
          {modulo === 'administradores' && (
            <>
              <form className="relatorios-controles sa-filtros" key={`${academiaAdmin}:${buscaAdmin}:${excluidosAdmin}`} onSubmit={(evento) => {
                evento.preventDefault();
                const dados = new FormData(evento.currentTarget);
                const novosParametros = {};
                for (const campo of ['busca', 'academia', 'excluidos']) {
                  const valor = dados.get(campo).trim();
                  if (valor) novosParametros[campo] = valor;
                }
                setPaginacao({ modulo, pagina: 1 });
                setParametros(novosParametros);
              }}>
                <label>Nome ou e-mail
                  <input className="relatorios-select" type="search" name="busca" maxLength={120} defaultValue={buscaAdmin} />
                </label>
                <label>ID da academia
                  <input className="relatorios-select" type="text" name="academia" inputMode="numeric"
                    pattern="[1-9][0-9]{0,9}" maxLength={10} defaultValue={academiaAdmin} />
                </label>
                <label>Contas
                  <select className="relatorios-select" name="excluidos" defaultValue={excluidosAdmin ? '1' : ''}>
                    <option value="">Ativas e inativas</option>
                    <option value="1">Somente excluídas</option>
                  </select>
                </label>
                <button className="relatorios-btn relatorios-btn-primario" type="submit">Filtrar</button>
                {(academiaAdmin || buscaAdmin || excluidosAdmin) && (
                  <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={() => {
                    setPaginacao({ modulo, pagina: 1 });
                    setParametros({});
                  }}>Limpar filtros</button>
                )}
              </form>

            </>
          )}
          {modulo === 'academias' && novaAcademia && (
            <NovaAcademia selecao={novaAcademia === true ? undefined : novaAcademia}
              fechar={() => setNovaAcademia(false)} confirmar={atualizarCadastro} sessaoEncerrada={encerrarPorSessao} />
          )}
          {modulo === 'academias' && operacaoAcademia && (
            <AcademiaOperacional selecao={operacaoAcademia}
              fechar={() => setOperacaoAcademia(null)} sessaoEncerrada={encerrarPorSessao}
              atualizar={(mensagem) => {
                setOperacaoAcademia(null);
                setConfirmacao(mensagem);
                setAtualizacao((valor) => valor + 1);
              }} />
          )}
          {!atual && <p role="status" className="relatorio-vazio">Carregando dados…</p>}
          {atual?.erro && (
            <div className="relatorio-aviso-box" role="alert">
              <p>{atual.erro}</p>
              <button type="button" className="relatorios-btn relatorios-btn-secundario"
                onClick={() => setAtualizacao((valor) => valor + 1)}>Tentar novamente</button>
            </div>
          )}
          {modulo === 'assinaturas' && <AssinaturasWcFit key={academiaAdmin} dados={atual?.dados} versao={atualizacao}
            academiaInicial={/^[1-9]\d{0,9}$/.test(academiaAdmin) && Number(academiaAdmin) <= 2147483647 ? Number(academiaAdmin) : null}
            sessaoEncerrada={encerrarPorSessao} atualizar={() => setAtualizacao((valor) => valor + 1)}
            mudarPagina={(numero, busca) => {
              if (busca !== undefined) setBuscaComercial(busca);
              setPaginacao({ modulo, pagina: numero });
            }} />}
          {modulo !== 'assinaturas' && atual?.dados && (modulo === 'dashboard' ? <Indicadores dados={atual.dados} /> :
            <Registros dados={atual.dados} modulo={modulo} selecionarOperacao={setOperacaoAcademia}
              selecionarAdministrador={setAdministradorSelecionado} selecionarCadastro={setNovaAcademia}
              mudarPagina={(numero) => setPaginacao({ modulo, pagina: numero })} />)}
          {modulo === 'administradores' && administradorSelecionado && <GestaoAdministrador
            key={administradorSelecionado.id} id={administradorSelecionado.id} nome={administradorSelecionado.nome}
            fechar={() => setAdministradorSelecionado(null)} sessaoEncerrada={encerrarPorSessao}
            atualizar={() => setAtualizacao(valor => valor + 1)} />}
          {modulo === 'administradores' && <ConvitesAdministradores key={academiaAdmin}
            academia={academiaAdmin} sessaoEncerrada={encerrarPorSessao} versao={atualizacao} />}
        </div>
      </main>
    </div>
  );
}
