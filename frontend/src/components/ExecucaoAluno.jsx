import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, History, Pause, Play, Timer, Trophy } from 'lucide-react';
import { requisitar } from '../apiPortalAluno';
import ResumoExecucao from './ResumoExecucao';
import { dataTreino } from '../formatarExecucao';
import '../styles/execucaoAluno.css';

const chave = () => crypto.randomUUID();

export function IniciarTreino({ fichaId }) {
  const navigate = useNavigate();
  const chaveAtual = useRef(null);
  const emCurso = useRef(false);
  const [ocupado,setOcupado] = useState(false);
  const [erro,setErro] = useState('');
  async function iniciar() {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setErro('');
    try {
      chaveAtual.current ||= chave();
      const sessao = await requisitar('/execucoes/iniciar',{ corpo:{ ficha_id:fichaId,chave:chaveAtual.current } });
      navigate('/aluno/execucao/' + sessao.id);
    } catch (falha) {
      if (falha.status === 401) navigate('/aluno/login',{ replace:true });
      else {
        const dados = falha.status === 409 ? await requisitar('/execucoes').catch(() => null) : null;
        if (dados?.aberta) navigate('/aluno/execucao/' + dados.aberta.id);
        else setErro(falha.message);
      }
    } finally {
      emCurso.current = false;
      setOcupado(false);
    }
  }
  return <div className="portal-acao-treino">
    <button className="portal-botao" type="button" onClick={iniciar} disabled={ocupado}>
      <Play size={20} aria-hidden="true" /> {ocupado ? 'Abrindo…' : 'Iniciar treino'}
    </button>
    {erro && <p className="portal-erro" role="alert">{erro}</p>}
  </div>;
}

export function TreinoEmAberto() {
  const [sessao,setSessao] = useState(null);
  useEffect(() => {
    const controle = new AbortController();
    requisitar('/execucoes',{ signal:controle.signal }).then((dados) => {
      if (!controle.signal.aborted) setSessao(dados.aberta);
    }).catch(() => {});
    return () => controle.abort();
  },[]);
  return <div className="portal-acao-treino">
    {sessao && <Link className="portal-botao" to={'/aluno/execucao/' + sessao.id}>
      <Play size={20} aria-hidden="true" /> {sessao.estado === 'pausado' ? 'Retomar' : 'Continuar'} {sessao.nome}
    </Link>}
    <Link className="portal-voltar" to="/aluno/historico"><History size={19} aria-hidden="true" /> Histórico de treinos</Link>
  </div>;
}

export function HistoricoTreinosAluno() {
  const navigate = useNavigate();
  const [pagina,setPagina] = useState(1);
  const [dados,setDados] = useState(null);
  const [erro,setErro] = useState('');
  useEffect(() => {
    const controle = new AbortController();
    requisitar('/execucoes?pagina=' + pagina,{ signal:controle.signal })
      .then((resultado) => {
        if (!controle.signal.aborted) setDados(resultado);
      }).catch((falha) => {
        if (controle.signal.aborted) return;
        if (falha.status === 401) navigate('/aluno/login',{ replace:true });
        else setErro(falha.message);
      });
    return () => controle.abort();
  },[pagina,navigate]);

  function irPara(valor) {
    setDados(null);
    setErro('');
    setPagina(valor);
  }

  return <>
    <Link className="portal-voltar" to="/aluno/treinos"><ArrowLeft size={18} aria-hidden="true" /> Treinos</Link>
    <h1>Histórico de treinos</h1>
    {erro && <p className="portal-erro" role="alert">{erro}</p>}
    {!erro && !dados && <p role="status">Carregando histórico…</p>}
    {dados?.historico.length === 0 && <p className="portal-card portal-vazio">Nenhum treino finalizado nesta página.</p>}
    {dados && <div className="portal-fichas">{dados.historico.map((sessao) => (
      <Link key={sessao.id} className="portal-card portal-historico-item" to={'/aluno/execucao/' + sessao.id}>
        <h2>{sessao.nome}</h2><p>{dataTreino(sessao.finalizado_em)}</p><ResumoExecucao sessao={sessao} />
      </Link>
    ))}</div>}
    {dados && (pagina > 1 || dados.tem_mais) && <div className="portal-acao-treino">
      <button className="portal-botao portal-botao-secundario" type="button" disabled={pagina === 1} onClick={() => irPara(pagina-1)}>Página anterior</button>
      <button className="portal-botao portal-botao-secundario" type="button" disabled={!dados.tem_mais} onClick={() => irPara(pagina+1)}>Próxima página</button>
    </div>}
  </>;
}

function segundosPrevistos(texto) {
  const relogio = /^(\d+):(\d{2})$/.exec(texto.trim());
  if (relogio) return Math.min(1800,Number(relogio[1])*60+Number(relogio[2]));
  const valor = Number(texto.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',','.'));
  return Number.isFinite(valor) ? Math.min(1800,Math.round(valor*(/min/i.test(texto) ? 60 : 1))) : 60;
}

function Descanso({ sessao, ocupado, segundos, setSegundos, enviar }) {
  const [agora,setAgora] = useState(Date.now);
  const prazo = sessao.descanso_ate ? Date.parse(sessao.descanso_ate) : null;
  const restante = prazo ? Math.max(0,Math.ceil((prazo-agora-sessao.desvio)/1000)) : Math.ceil((sessao.descanso_pausado_ms || 0)/1000);
  const anunciou = useRef(null);
  const [aviso,setAviso] = useState(false);

  useEffect(() => {
    if (!prazo) return;
    let intervalo;
    const atualizar = () => {
      const instante = Date.now();
      setAgora(instante);
      if (instante+sessao.desvio >= prazo) clearInterval(intervalo);
    };
    intervalo = setInterval(atualizar,250);
    atualizar();
    document.addEventListener('visibilitychange',atualizar);
    window.addEventListener('pageshow',atualizar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange',atualizar);
      window.removeEventListener('pageshow',atualizar);
    };
  },[prazo,sessao.desvio]);

  useEffect(() => {
    if (prazo && restante === 0 && anunciou.current !== prazo) {
      anunciou.current = prazo;
      setAviso(true);
      if (!document.hidden) navigator.vibrate?.(140);
    }
  },[prazo,restante]);

  const relogio = `${Math.floor(restante/60)}:${String(restante%60).padStart(2,'0')}`;
  return <section className="portal-card portal-descanso" aria-labelledby="portal-descanso-titulo">
    <div><h2 id="portal-descanso-titulo"><Timer size={21} aria-hidden="true" /> Descanso</h2>
      <p className="portal-contagem" aria-label={`${restante} segundos restantes`}>{relogio}</p>
      <p className="portal-descanso-aviso" role="status">{aviso && prazo === anunciou.current && restante === 0 ? 'Descanso concluído.' : ''}</p>
    </div>
    <div className="portal-descanso-controles">
      <label>Segundos<input aria-label="Duração do descanso em segundos" type="number" min="0" max="1800"
        value={segundos} onChange={(e) => setSegundos(e.target.value)} disabled={ocupado} /></label>
      <button className="portal-botao portal-botao-secundario" type="button" disabled={ocupado || !descansoValido(segundos)}
        onClick={() => enviar({ acao:'descanso',segundos:Number(segundos) })}>Ajustar descanso</button>
      {prazo && restante > 0 && <button className="portal-botao portal-botao-secundario" type="button" disabled={ocupado}
        onClick={() => enviar({ acao:'descanso',segundos:0 })}>Encerrar descanso</button>}
    </div>
  </section>;
}

const descansoValido = (valor) => valor !== '' && Number.isInteger(Number(valor)) && Number(valor) >= 0 && Number(valor) <= 1800;

function Serie({ numero, exercicio, valor, segundos, bloqueado, enviar }) {
  const [carga,setCarga] = useState(valor?.carga ?? exercicio.ultima_carga ?? '');
  const [repeticoes,setRepeticoes] = useState(valor?.repeticoes ?? (/^\d+$/.test(exercicio.repeticoes) ? exercicio.repeticoes : ''));
  const reps = Number(repeticoes);
  const kg = Number(carga);
  const valido = carga !== '' && Number.isFinite(kg) && kg >= 0 && kg <= 5000 &&
    Number.isInteger(reps) && reps >= 1 && reps <= 10000 && descansoValido(segundos);
  return <li className={`portal-serie ${valor ? 'registrada' : ''}`}>
    <div className="portal-serie-titulo">
      <strong>Série {numero}</strong>
      {valor && <span><Check size={16} aria-hidden="true" /> Concluída</span>}
    </div>
    <div className="portal-serie-dados">
      <label>Carga (kg)<input type="number" min="0" max="5000" step="any" inputMode="decimal"
        value={carga} onChange={(e) => setCarga(e.target.value)} disabled={bloqueado} /></label>
      <label>Repetições<input type="number" min="1" max="10000" inputMode="numeric"
        value={repeticoes} onChange={(e) => setRepeticoes(e.target.value)} disabled={bloqueado} /></label>
    </div>
    <div className="portal-acao-treino">
      <button className="portal-botao" type="button" disabled={bloqueado || !valido}
        onClick={() => enviar({ acao:'registrar_serie',serie:numero,carga:kg,repeticoes:reps,segundos:Number(segundos) })}>
        {valor ? 'Salvar ajustes' : 'Concluir série'}
      </button>
      {valor && <button className="portal-botao portal-botao-secundario" type="button" disabled={bloqueado}
        onClick={() => enviar({ acao:'remover_serie',serie:numero })}>Desmarcar</button>}
    </div>
  </li>;
}

function ExercicioAtual({ sessao, ocupado, enviar }) {
  const indice = sessao.exercicio_atual;
  const ex = sessao.exercicios[indice];
  const [segundos,setSegundos] = useState(() => segundosPrevistos(ex.descanso));
  const bloqueado = ocupado || sessao.estado === 'pausado';
  return <>
    <div className="portal-execucao-navegacao">
      <button className="portal-botao portal-botao-secundario" type="button" disabled={bloqueado || indice === 0}
        onClick={() => enviar({ acao:'navegar',exercicio:indice-1 })}><ArrowLeft size={17} aria-hidden="true" /> Anterior</button>
      <p>Exercício {indice+1} de {sessao.exercicios.length}</p>
      <button className="portal-botao portal-botao-secundario" type="button" disabled={bloqueado || indice+1 === sessao.exercicios.length}
        onClick={() => enviar({ acao:'navegar',exercicio:indice+1 })}>Próximo <ArrowRight size={17} aria-hidden="true" /></button>
    </div>
    <article className="portal-card portal-exercicio">
      {ex.imagem_url && <img src={ex.imagem_url} alt={`Demonstração de ${ex.nome}`} referrerPolicy="no-referrer" />}
      <div><h2>{ex.nome}</h2>
        <dl className="portal-metricas">
          {[['Séries',ex.series],['Repetições',ex.repeticoes],['Carga prescrita',ex.carga],['Descanso prescrito',ex.descanso]]
            .map(([rotulo,valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor || '—'}</dd></div>)}
        </dl>
        {ex.ultima_carga != null && <p><strong>Última carga registrada</strong> · {ex.ultima_carga} kg</p>}
        {ex.instrucoes && <p>{ex.instrucoes}</p>}
        {ex.observacao && <p><strong>Orientações da ficha</strong><br />{ex.observacao}</p>}
      </div>
    </article>
    <Descanso sessao={sessao} ocupado={bloqueado} segundos={segundos} setSegundos={setSegundos} enviar={enviar} />
    <ol className="portal-series" aria-label="Séries do exercício">
      {Array.from({length:ex.total_series},(_,i) => {
        const valor = sessao.series[`${indice}:${i+1}`];
        return <Serie key={`${i+1}:${valor?.versao ?? 0}`} numero={i+1} valor={valor} exercicio={ex} segundos={segundos}
          bloqueado={bloqueado} enviar={(dados) => enviar({ ...dados,exercicio:indice })} />;
      })}
    </ol>
  </>;
}

export function ExecucaoAluno({ id }) {
  const navigate = useNavigate();
  const [sessao,setSessao] = useState(null);
  const [ocupado,setOcupado] = useState(false);
  const [erro,setErro] = useState('');
  const [reenvio,setReenvio] = useState(null);
  const [consulta,setConsulta] = useState(0);
  const emCurso = useRef(false);
  const rota = '/execucoes/' + id;

  function aceitar(valor) {
    setSessao({ ...valor,desvio:Date.parse(valor.agora)-Date.now() });
  }

  useEffect(() => {
    const controle = new AbortController();
    requisitar(rota,{ signal:controle.signal }).then((dados) => {
      if (!controle.signal.aborted) aceitar(dados);
    }).catch((falha) => {
      if (controle.signal.aborted) return;
      if (falha.status === 401) navigate('/aluno/login',{ replace:true });
      else setErro(falha.message);
    });
    return () => controle.abort();
  },[rota,consulta,navigate]);

  async function gravar(comando) {
    if (emCurso.current) return;
    emCurso.current = true;
    setOcupado(true);
    setErro('');
    try {
      aceitar(await requisitar(rota,{ corpo:comando }));
      setReenvio(null);
    } catch (falha) {
      if (falha.status === 401) {
        setSessao(null);
        navigate('/aluno/login',{ replace:true });
      } else {
        setErro(falha.message);
        if (falha.status === 409) {
          setReenvio(null);
          setSessao(null);
          setConsulta((valor) => valor+1);
        } else if (!falha.status || falha.status >= 500) setReenvio(comando);
        else setReenvio(null);
      }
    } finally {
      emCurso.current = false;
      setOcupado(false);
    }
  }

  function enviar(dados) {
    return gravar({ ...dados,versao:sessao.versao,chave:chave() });
  }

  const acaoBloqueada = ocupado || Boolean(reenvio);
  return <>
    <Link className="portal-voltar" to={sessao?.estado === 'finalizado' ? '/aluno/historico' : '/aluno/treinos'}>
      <ArrowLeft size={18} aria-hidden="true" /> {sessao?.estado === 'finalizado' ? 'Histórico' : 'Treinos'}
    </Link>
    {erro && <div role="alert" className="portal-erro">
      <p>{erro}</p>
      {reenvio && <button className="portal-botao" type="button" onClick={() => gravar(reenvio)} disabled={ocupado}>Tentar salvar novamente</button>}
    </div>}
    {!sessao && !erro && <p role="status">Carregando execução…</p>}
    {sessao?.estado === 'finalizado' && <section className="portal-card portal-resumo">
      <Trophy size={30} aria-hidden="true" />
      <h1>Treino finalizado</h1><h2>{sessao.nome}</h2><p>{dataTreino(sessao.finalizado_em)}</p>
      <ResumoExecucao sessao={sessao} detalhado />
    </section>}
    {sessao && sessao.estado !== 'finalizado' && <>
      <section className="portal-boas-vindas portal-execucao-topo">
        <p>{sessao.estado === 'pausado' ? 'Treino pausado' : 'Em execução'}</p>
        <h1>{sessao.nome}</h1>
        <label htmlFor="progresso-musc">{sessao.series_concluidas} de {sessao.series_previstas} séries concluídas</label>
        <progress id="progresso-musc" value={sessao.series_concluidas} max={sessao.series_previstas} />
        <div className="portal-acao-treino">
          <button className="portal-botao" type="button" disabled={acaoBloqueada}
            onClick={() => enviar({ acao:sessao.estado === 'pausado' ? 'retomar' : 'pausar' })}>
            {sessao.estado === 'pausado' ? <><Play size={19} aria-hidden="true" /> Retomar</>
              : <><Pause size={19} aria-hidden="true" /> Pausar</>}
          </button>
          <button className="portal-botao portal-botao-secundario" type="button" disabled={acaoBloqueada}
            onClick={() => { if (window.confirm('Finalizar o treino e salvar o resumo no histórico?')) enviar({ acao:'finalizar' }); }}>
            <Check size={19} aria-hidden="true" /> Finalizar treino
          </button>
        </div>
      </section>
      <ExercicioAtual key={sessao.exercicio_atual} sessao={sessao} ocupado={acaoBloqueada} enviar={enviar} />
    </>}
  </>;
}

IniciarTreino.propTypes = { fichaId: PropTypes.string.isRequired };

Descanso.propTypes = {
  sessao: PropTypes.shape({
    descanso_ate: PropTypes.string,
    descanso_pausado_ms: PropTypes.number,
    desvio: PropTypes.number.isRequired,
  }).isRequired,
  ocupado: PropTypes.bool.isRequired,
  segundos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  setSegundos: PropTypes.func.isRequired,
  enviar: PropTypes.func.isRequired,
};

Serie.propTypes = {
  numero: PropTypes.number.isRequired,
  exercicio: PropTypes.shape({ ultima_carga: PropTypes.number, repeticoes: PropTypes.string.isRequired }).isRequired,
  valor: PropTypes.shape({ carga: PropTypes.number.isRequired, repeticoes: PropTypes.number.isRequired }),
  segundos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  bloqueado: PropTypes.bool.isRequired,
  enviar: PropTypes.func.isRequired,
};

ExercicioAtual.propTypes = {
  sessao: PropTypes.shape({
    exercicio_atual: PropTypes.number.isRequired,
    estado: PropTypes.string.isRequired,
    exercicios: PropTypes.arrayOf(PropTypes.shape({
      nome: PropTypes.string.isRequired,
      imagem_url: PropTypes.string,
      series: PropTypes.string,
      repeticoes: PropTypes.string.isRequired,
      carga: PropTypes.string,
      descanso: PropTypes.string.isRequired,
      ultima_carga: PropTypes.number,
      instrucoes: PropTypes.string,
      observacao: PropTypes.string,
      total_series: PropTypes.number.isRequired,
    })).isRequired,
    series: PropTypes.objectOf(PropTypes.shape({ versao: PropTypes.number.isRequired })).isRequired,
  }).isRequired,
  ocupado: PropTypes.bool.isRequired,
  enviar: PropTypes.func.isRequired,
};

ExecucaoAluno.propTypes = { id: PropTypes.string };
