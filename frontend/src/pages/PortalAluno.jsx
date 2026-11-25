import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Building2, ChevronRight, ClipboardList, Dumbbell, House, LogOut, Moon, Sun, Target, UserRound } from 'lucide-react';
import ControlesPwa, { PortalIndisponivel } from '../components/PortalPwa';
import { useConexaoPortal } from '../useConexaoPortal';
import EvolucaoAluno from '../components/EvolucaoAluno';
import { basePortal, requisitar } from '../apiPortalAluno';
import { ExecucaoAluno, HistoricoTreinosAluno, IniciarTreino, TreinoEmAberto } from '../components/ExecucaoAluno';
import { MENSAGEM_SENHA, senhaValida } from '../politicaSenha';
import '../styles/portalAluno.css';

function MarcaPortal() {
  return <Link to="/aluno/login" className="portal-marca"><Dumbbell size={23} aria-hidden="true" /> Wc Fit</Link>;
}

function Tema({ tema, alternar }) {
  return <button type="button" className="portal-icone-botao" aria-label={tema === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={alternar}>
    {tema === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
  </button>;
}

function Acesso({ tema, alternar }) {
  const [modo, setModo] = useState('entrar');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [academias, setAcademias] = useState([]);
  const [academia, setAcademia] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const navigate = useNavigate();

  function trocar(valor) {
    setModo(valor);
    setAcademias([]);
    setAcademia('');
    setSenha('');
    setCodigo('');
    setErro('');
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    if (modo === 'codigo' && !senhaValida(senha)) {
      setErro(MENSAGEM_SENHA);
      return;
    }
    setOcupado(true);
    try {
      const corpo = modo === 'codigo' ? { cpf, codigo:codigo.trim(), senha }
        : { cpf, senha, ...(academia && { academia_id:Number(academia) }) };
      const resposta = await requisitar(modo === 'codigo' ? '/ativar' : '/entrar', { corpo });
      if (resposta?.academias) {
        setAcademias(resposta.academias);
        return;
      }
      setSenha('');
      setCodigo('');
      navigate('/aluno/', { replace:true });
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setOcupado(false);
    }
  }

  return <main className="portal-login">
    <header className="portal-topo"><MarcaPortal /><Tema tema={tema} alternar={alternar} /></header>
    <div className="portal-login-grade">
      <div className="portal-login-apresentacao">
        <Dumbbell size={36} aria-hidden="true" />
        <p>Portal do Aluno</p>
        <h1>Seu treino sempre à mão.</h1>
        <p>Acesse suas fichas e acompanhe as orientações da sua academia.</p>
      </div>
      <section className="portal-card portal-login-form" aria-labelledby="portal-acesso-titulo">
        <h2 id="portal-acesso-titulo">{modo === 'codigo' ? 'Defina sua senha' : 'Entre no seu portal'}</h2>
        {modo === 'codigo' && <p>Use o código de primeiro acesso ou de recuperação emitido pela sua academia.</p>}
        <form onSubmit={enviar}>
          <label>CPF<input name="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} type="text" inputMode="numeric"
            autoComplete="username" maxLength={14} placeholder="000.000.000-00" required disabled={ocupado || academias.length > 0} /></label>
          {modo === 'codigo' && <label>Código da academia
            <input name="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="one-time-code"
              spellCheck={false} autoCapitalize="none" maxLength={52} required disabled={ocupado} />
          </label>}
          <label>{modo === 'codigo' ? 'Nova senha' : 'Senha'}<input name="senha" type="password" value={senha}
            onChange={(e) => setSenha(e.target.value)} autoComplete={modo === 'codigo' ? 'new-password' : 'current-password'}
            maxLength={72} required disabled={ocupado || academias.length > 0} /></label>
          {academias.length > 0 && <label>Selecione a academia
            <select value={academia} onChange={(e) => setAcademia(e.target.value)} required disabled={ocupado}>
              <option value="">Selecione seu vínculo</option>
              {academias.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>}
          {erro && <p className="portal-erro" role="alert">{erro}</p>}
          <button type="submit" className="portal-botao" disabled={ocupado}>{ocupado ? 'Aguarde…' : modo === 'codigo' ? 'Salvar senha e entrar' : 'Entrar'}</button>
        </form>
        <div className="portal-login-opcoes">
          {modo === 'entrar'
            ? <button type="button" onClick={() => trocar('codigo')} disabled={ocupado}>Primeiro acesso ou esqueci a senha</button>
            : <button type="button" onClick={() => trocar('entrar')} disabled={ocupado}>Voltar para entrar</button>}
          {academias.length > 0 && <button type="button" onClick={() => trocar('entrar')} disabled={ocupado}>Usar outro CPF ou senha</button>}
        </div>
      </section>
    </div>
  </main>;
}

const secoes = [
  ['/aluno/', 'Início', House],
  ['/aluno/treinos', 'Treinos', Dumbbell],
  ['/aluno/evolucao', 'Evolução', Activity],
  ['/aluno/matricula', 'Matrícula', ClipboardList],
  ['/aluno/perfil', 'Perfil', UserRound],
];

function Fichas({ fichas }) {
  return fichas.length ? <div className="portal-fichas">
    {fichas.map((ficha) => <Link key={ficha.id} className="portal-card portal-ficha" to={`/aluno/treino/${ficha.id}`}>
      <span className="portal-ficha-icone"><Dumbbell size={22} aria-hidden="true" /></span>
      <div><h3>{ficha.nome}</h3><p>{ficha.exercicios.length} {ficha.exercicios.length === 1 ? 'exercício' : 'exercícios'}{ficha.modelo ? ` · ${ficha.modelo}` : ''}</p></div>
      <ChevronRight size={19} aria-hidden="true" />
    </Link>)}
  </div> : <p className="portal-card portal-vazio">Sua academia ainda não disponibilizou uma ficha de treino.</p>;
}

function Inicio({ dados }) {
  return <>
    <section className="portal-boas-vindas">
      <p>{dados.academia}</p>
      <h1>Olá, {dados.nome}!</h1>
      <p>{dados.professor ? `Professor responsável: ${dados.professor}` : 'Professor responsável ainda não informado.'}</p>
    </section>
    <section className="portal-card portal-objetivo">
      <Target size={24} aria-hidden="true" />
      <div><h2>Seu objetivo</h2><p>{dados.objetivo || 'Seu professor ainda não cadastrou um objetivo.'}</p></div>
    </section>
    <TreinoEmAberto />
    <section aria-labelledby="portal-fichas-titulo">
      <h2 id="portal-fichas-titulo" className="portal-titulo-secao">Suas fichas de treino</h2>
      <Fichas fichas={dados.fichas} />
    </section>
  </>;
}

function Treino({ ficha }) {
  return ficha ? <>
    <Link to="/aluno/treinos" className="portal-voltar"><ArrowLeft size={18} aria-hidden="true" /> Todas as fichas</Link>
    <div className="portal-titulo"><h1>{ficha.nome}</h1>{ficha.descricao && <p>{ficha.descricao}</p>}</div>
    {ficha.exercicios.length > 0 && <IniciarTreino fichaId={ficha.id} />}
    {ficha.exercicios.length === 0 && <p className="portal-card portal-vazio">Nenhum exercício foi informado nesta divisão.</p>}
    <ol className="portal-exercicios">
      {ficha.exercicios.map((exercicio, i) => <li className="portal-card portal-exercicio" key={i}>
        {exercicio.imagem_url && <img src={exercicio.imagem_url} alt={`Demonstração de ${exercicio.nome}`} loading="lazy" referrerPolicy="no-referrer" />}
        <div>
          <h2>{exercicio.nome}</h2>
          <dl className="portal-metricas">
            {[['Séries',exercicio.series],['Repetições',exercicio.repeticoes],['Carga',exercicio.carga],['Descanso',exercicio.descanso]]
              .map(([rotulo, valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor || '—'}</dd></div>)}
          </dl>
          {exercicio.instrucoes && <p>{exercicio.instrucoes}</p>}
          {exercicio.observacao && <p><strong>Observações</strong><br />{exercicio.observacao}</p>}
        </div>
      </li>)}
    </ol>
  </> : <Navigate to="/aluno/treinos" replace />;
}

const dataBr = (data) => typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)
  ? data.slice(0,10).split('-').reverse().join('/') : '—';
const situacoes = { vigente:'Vigente', vencida:'Vencida', futura:'Futura', cancelada:'Cancelada' };

function Matriculas({ itens }) {
  return <>
    <div className="portal-titulo"><h1>Matrícula</h1><p>Planos e vigências informados pela academia.</p></div>
    {itens.length ? <div className="portal-fichas">
      {itens.map((item) => <article key={item.id} className="portal-card portal-info">
        <h2>{item.plano}</h2><p>{situacoes[item.situacao] || 'Consulte a academia'}</p>
        <dl className="portal-metricas"><div><dt>Início</dt><dd>{dataBr(item.data_inicio)}</dd></div>
          <div><dt>Vencimento</dt><dd>{dataBr(item.data_vencimento)}</dd></div></dl>
      </article>)}
    </div> : <p className="portal-card portal-vazio">Nenhuma matrícula disponível.</p>}
  </>;
}

function Perfil({ dados }) {
  return <>
    <div className="portal-titulo"><h1>Meu perfil</h1><p>Dados cadastrados pela academia.</p></div>
    <dl className="portal-card portal-perfil">
      {[['Nome',dados.nome],['Academia',dados.academia],['E-mail',dados.email],['Telefone',dados.telefone]]
        .map(([rotulo,valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor || '—'}</dd></div>)}
    </dl>
  </>;
}

function Painel({ tela, tema, alternar, sair }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [consulta, setConsulta] = useState(0);
  const [logoFalhou, setLogoFalhou] = useState(false);
  const navigate = useNavigate();
  const { fichaId } = useParams();

  useEffect(() => {
    let controle;
    function consultar() {
      controle?.abort();
      const atual = new AbortController();
      controle = atual;
      requisitar('/painel', { signal:atual.signal }).then((resultado) => {
        if (atual.signal.aborted) return;
        setDados(resultado);
        setErro('');
      }).catch((falha) => {
        if (atual.signal.aborted) return;
        setDados(null);
        if (falha.status === 401) navigate('/aluno/login', { replace:true });
        else setErro(falha.message);
      });
    }
    function ocultar() {
      controle?.abort();
      setDados(null);
    }
    function visibilidade() {
      if (document.hidden) ocultar();
      else consultar();
    }
    function restaurar(evento) {
      if (evento.persisted) {
        ocultar();
        consultar();
      }
    }
    if (!document.hidden) consultar();
    window.addEventListener('focus', consultar);
    window.addEventListener('pagehide', ocultar);
    window.addEventListener('pageshow', restaurar);
    document.addEventListener('visibilitychange',visibilidade);
    return () => {
      controle?.abort();
      window.removeEventListener('focus', consultar);
      window.removeEventListener('pagehide', ocultar);
      window.removeEventListener('pageshow', restaurar);
      document.removeEventListener('visibilitychange',visibilidade);
    };
  }, [consulta,navigate,tela]);

  return <div className="portal-painel">
    <header className="portal-topo">
      <div className="portal-marca">
        {dados?.logo_disponivel && !logoFalhou ? <img src={basePortal + '/logotipo'} alt="" onError={() => setLogoFalhou(true)} />
          : <Building2 size={24} aria-hidden="true" />}
        <span>{dados?.academia || 'Wc Fit'}</span>
      </div>
      <div className="portal-topo-acoes">
        <Tema tema={tema} alternar={alternar} />
        <button type="button" className="portal-icone-botao" onClick={sair} aria-label="Sair do Portal do Aluno">
          <LogOut size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
    <main id="portal-conteudo" className="portal-conteudo">
      {erro && <div role="alert" className="portal-card portal-erro">
        <p>{erro}</p>
        {!dados && <button className="portal-botao" type="button" onClick={() => { setErro(''); setConsulta((v) => v + 1); }}>Tentar novamente</button>}
      </div>}
      {!erro && !dados && <p role="status">Carregando seu portal…</p>}
      {dados && <>
        {tela === 'inicio' && <Inicio dados={dados} />}
        {tela === 'treinos' && <><div className="portal-titulo"><h1>Treinos</h1><p>Fichas prescritas pela sua academia.</p></div><TreinoEmAberto /><Fichas fichas={dados.fichas} /></>}
        {tela === 'ficha' && <Treino ficha={dados.fichas.find((ficha) => ficha.id === fichaId)} />}
        {tela === 'execucao' && <ExecucaoAluno key={fichaId} id={fichaId} />}
        {tela === 'evolucao' && <EvolucaoAluno />}
        {tela === 'historico' && <HistoricoTreinosAluno />}
        {tela === 'matricula' && <Matriculas itens={dados.matriculas} />}
        {tela === 'perfil' && <Perfil dados={dados} />}
      </>}
    </main>
    <nav className="portal-navegacao" aria-label="Portal do Aluno">
      {secoes.map(([path, rotulo, Icone], indice) => {
        const ativo = tela === ['inicio', 'treinos', 'evolucao', 'matricula', 'perfil'][indice] ||
          (['ficha','execucao','historico'].includes(tela) && path === '/aluno/treinos');
        return <Link key={path} to={path} aria-current={ativo ? 'page' : undefined} className={ativo ? 'ativo' : undefined}>
          <Icone size={21} aria-hidden="true" />{rotulo}
        </Link>;
      })}
    </nav>
  </div>;
}

export default function PortalAluno({ tela }) {
  const conexao = useConexaoPortal();
  const navigate = useNavigate();
  const local = useLocation();
  const [saidaPendente,setSaidaPendente] = useState(false);
  const [erroSaida,setErroSaida] = useState('');
  const [enviando,setEnviando] = useState(false);
  const [tema,setTema] = useState(() => {
    try { return localStorage.getItem('wcfit_tema_aluno') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });

  useEffect(() => {
    if (local.pathname === '/aluno') navigate('/aluno/'+local.search+local.hash,{ replace:true });
  },[local,navigate]);

  useEffect(() => {
    if (!saidaPendente || conexao.indisponivel) return;
    const controle = new AbortController();
    setEnviando(true);
    setErroSaida('');
    requisitar('/sair',{ corpo:{}, signal:controle.signal }).then(() => {
      if (controle.signal.aborted) return;
      setSaidaPendente(false);
      navigate('/aluno/login',{ replace:true });
    }).catch((falha) => {
      if (!controle.signal.aborted) setErroSaida(falha.message);
    }).finally(() => {
      if (!controle.signal.aborted) setEnviando(false);
    });
    return () => controle.abort();
  },[saidaPendente,conexao.indisponivel,conexao.tentativa,navigate]);

  function alternar() {
    const novo = tema === 'dark' ? 'light' : 'dark';
    setTema(novo);
    try { localStorage.setItem('wcfit_tema_aluno',novo); } catch { /* Preferência da sessão. */ }
  }

  return <div className="portal-aluno" data-portal-tema={tema}>
    <ControlesPwa podeAtualizar={tela !== 'execucao' && !conexao.indisponivel && !saidaPendente} />
    {(conexao.indisponivel || saidaPendente) ? <PortalIndisponivel tentar={conexao.tentar}
      saidaPendente={saidaPendente} enviando={enviando && !conexao.indisponivel} erroSaida={erroSaida} />
      : tela === 'login' ? <Acesso tema={tema} alternar={alternar} />
        : <Painel key={conexao.tentativa} tela={tela} tema={tema} alternar={alternar} sair={() => setSaidaPendente(true)} />}
  </div>;
}

const temaPortal = PropTypes.oneOf(['light', 'dark']).isRequired;
const telaPortal = PropTypes.oneOf(['login', 'inicio', 'treinos', 'ficha', 'execucao', 'evolucao', 'historico', 'matricula', 'perfil']).isRequired;
const fichaPortal = PropTypes.shape({
  id: PropTypes.string.isRequired, nome: PropTypes.string.isRequired,
  descricao: PropTypes.string, modelo: PropTypes.string,
  exercicios: PropTypes.arrayOf(PropTypes.shape({
    nome: PropTypes.string.isRequired, imagem_url: PropTypes.string, instrucoes: PropTypes.string,
    series: PropTypes.string, repeticoes: PropTypes.string, carga: PropTypes.string,
    descanso: PropTypes.string, observacao: PropTypes.string,
  })).isRequired,
});

Tema.propTypes = { tema: temaPortal, alternar: PropTypes.func.isRequired };
Acesso.propTypes = { tema: temaPortal, alternar: PropTypes.func.isRequired };
Fichas.propTypes = { fichas: PropTypes.arrayOf(fichaPortal).isRequired };
Inicio.propTypes = {
  dados: PropTypes.shape({
    academia: PropTypes.string.isRequired, nome: PropTypes.string.isRequired,
    professor: PropTypes.string, objetivo: PropTypes.string,
    fichas: PropTypes.arrayOf(fichaPortal).isRequired,
  }).isRequired,
};
Treino.propTypes = { ficha: fichaPortal };
Matriculas.propTypes = {
  itens: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired, plano: PropTypes.string, situacao: PropTypes.string,
    data_inicio: PropTypes.string, data_vencimento: PropTypes.string,
  })).isRequired,
};
Perfil.propTypes = {
  dados: PropTypes.shape({
    nome: PropTypes.string.isRequired, academia: PropTypes.string.isRequired,
    email: PropTypes.string, telefone: PropTypes.string,
  }).isRequired,
};
Painel.propTypes = {
  tela: telaPortal, tema: temaPortal,
  alternar: PropTypes.func.isRequired, sair: PropTypes.func.isRequired,
};
PortalAluno.propTypes = { tela: telaPortal };
