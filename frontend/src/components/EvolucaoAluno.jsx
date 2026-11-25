import PropTypes from 'prop-types';
import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, CartesianGrid, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CalendarDays, Clock, Dumbbell, History, Target, Trophy } from 'lucide-react';
import api from '../api';
import { requisitar } from '../apiPortalAluno';
import { duracaoTreino } from '../formatarExecucao';
import '../styles/evolucaoAluno.css';

const dataCurta = (valor) => valor.slice(5).split('-').reverse().join('/');
const unidade = new Intl.NumberFormat('pt-BR',{ maximumFractionDigits:2 });
const mes = new Intl.DateTimeFormat('pt-BR',{ month:'long',year:'numeric',timeZone:'UTC' });

function Calendario({ dados }) {
  const dias = new Map(dados.calendario.map((item) => [item.dia,item.treinos]));
  const meses = new Map();
  const inicio = Date.parse(dados.inicio);
  const fim = Date.parse(dados.fim);
  for (let instante = inicio; instante <= fim; instante += 86400000) {
    const data = new Date(instante);
    const dia = data.toISOString().slice(0,10);
    const chave = dia.slice(0,7);
    if (!meses.has(chave)) meses.set(chave,[]);
    meses.get(chave).push({ dia,numero:data.getUTCDate(),coluna:(data.getUTCDay()+6)%7+1,treinos:dias.get(dia) || 0 });
  }
  return <div className="evolucao-calendarios">
    {[...meses].map(([chave,itens]) => <div key={chave}>
      <h3>{mes.format(new Date(chave+'-01'))}</h3>
      <div className="evolucao-semana" aria-hidden="true">
        {['S','T','Q','Q','S','S','D'].map((letra,i) => <span key={i}>{letra}</span>)}
      </div>
      <ol className="evolucao-semana" aria-label={mes.format(new Date(chave+'-01'))}>
        {itens.map(({ dia,numero,coluna,treinos },i) => (
          <li key={dia} className={treinos ? 'treinado' : undefined}
            style={i === 0 ? {gridColumnStart:coluna} : undefined}
            aria-label={`${dataCurta(dia)}, ${treinos === 1 ? '1 treino' : treinos+' treinos'}`}>
            {numero}
          </li>
        ))}
      </ol>
    </div>)}
  </div>;
}

function Grafico({ dados, campo, titulo, cor }) {
  return <div className="evolucao-grafico">
    <h3>{titulo}</h3>
    <ResponsiveContainer width="100%" height={204}>
      <LineChart data={dados} accessibilityLayer margin={{top:12,right:15,left:0,bottom:0}}>
        <CartesianGrid vertical={false} stroke="var(--evolucao-borda)" />
        <XAxis dataKey="dia" tickFormatter={dataCurta} minTickGap={18} stroke="var(--evolucao-suave)" />
        <YAxis width={45} allowDecimals={campo === 'carga'} stroke="var(--evolucao-suave)" />
        <Tooltip labelFormatter={dataCurta} formatter={(valor) => [unidade.format(valor),titulo]}
          contentStyle={{background:'var(--evolucao-cartao)',color:'var(--evolucao-texto)'}} />
        <Line type="linear" dataKey={campo} stroke={cor} strokeWidth={2.5} dot={dados.length < 18} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function Metas({ dados, aluno }) {
  return <section className="evolucao-card">
    <h2><Target size={20} aria-hidden="true" /> Objetivo e meta semanal</h2>
    <p className="evolucao-objetivo">{dados.objetivo || 'Nenhum objetivo foi definido para este aluno.'}</p>
    {dados.meta_semanal ? <>
      <p><strong>{dados.treinos_semana} de {dados.meta_semanal} treinos</strong> na semana iniciada em {dataCurta(dados.segunda)}</p>
      <progress aria-label="Progresso da meta semanal" max={dados.meta_semanal} value={Math.min(dados.treinos_semana,dados.meta_semanal)} />
    </> : <p>Sem meta semanal definida.</p>}
    {aluno && <p className="evolucao-texto-suave">A meta é editada na aba Portal do Aluno.</p>}
  </section>;
}

export default function EvolucaoAluno({ aluno }) {
  const [periodo,setPeriodo] = useState('30');
  const [exercicio,setExercicio] = useState('');
  const [dados,setDados] = useState(null);
  const [erro,setErro] = useState('');
  const [tentativa,setTentativa] = useState(0);
  const [consultando,setConsultando] = useState(true);
  const navigate = useNavigate();
  const id = useId();

  useEffect(() => {
    let controle;
    function carregar() {
      controle?.abort();
      const atual = new AbortController();
      controle = atual;
      setConsultando(true);
      setErro('');
      const params = { periodo,...(exercicio && { exercicio }) };
      const requisicao = aluno
        ? api.get(`/alunos/${aluno}/portal/evolucao`,{ params,signal:atual.signal }).then((r) => r.data)
        : requisitar('/evolucao?'+new URLSearchParams(params),{ signal:atual.signal });
      requisicao.then((resposta) => {
        if (!atual.signal.aborted) { setDados(resposta); setConsultando(false); }
      }).catch((falha) => {
        if (atual.signal.aborted) return;
        setDados(null);
        setConsultando(false);
        if (!aluno && falha.status === 401) navigate('/aluno/login',{ replace:true });
        else setErro(falha.response?.data?.mensagem || falha.message || 'Não foi possível consultar a evolução.');
      });
    }
    carregar();
    window.addEventListener('focus',carregar);
    return () => {
      controle?.abort();
      window.removeEventListener('focus',carregar);
    };
  },[aluno,periodo,exercicio,navigate,tentativa]);

  const titulo = aluno ? <h2 id={id}>Evolução individual</h2> : <h1 id={id}>Sua evolução</h1>;
  return <section className="evolucao" aria-labelledby={id} aria-busy={consultando}>
    <header className="evolucao-cabecalho">
      <div>{titulo}<p>Resultados de treinos finalizados no Portal do Aluno.</p></div>
      {!aluno && <Link className="portal-voltar" to="/aluno/historico"><History size={19} aria-hidden="true" /> Histórico detalhado</Link>}
    </header>
    <div className="evolucao-card evolucao-filtros">
      <label>Período<select value={periodo} onChange={(e) => {setPeriodo(e.target.value);setExercicio('');setDados(null);}}>
        <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
      </select></label>
      <label>Exercício<select value={exercicio || dados?.exercicio || ''} disabled={!dados?.exercicios.length}
        onChange={(e) => setExercicio(e.target.value)}>
        {!dados?.exercicios.length && <option value="">Sem séries registradas</option>}
        {dados?.exercicios.map(({chave,nome}) => <option key={chave} value={chave}>{nome}</option>)}
      </select></label>
    </div>
    {!dados && consultando && <p role="status">Carregando evolução…</p>}
    {erro && <div className="evolucao-card" role="alert"><p>{erro}</p>
      <button className="btn-outline" type="button" onClick={() => setTentativa((v) => v+1)}>Tentar novamente</button></div>}
    {dados && <>
      <div className="evolucao-indicadores">
        {[[Dumbbell,'Treinos concluídos',dados.treinos],[Activity,'Dias com treino',dados.dias_treinados],
          [Clock,'Tempo de treino',duracaoTreino(dados.segundos)]].map(([Icone,rotulo,valor]) => (
          <div className="evolucao-card" key={rotulo}><Icone size={21} aria-hidden="true" /><span>{rotulo}</span><strong>{valor}</strong></div>
        ))}
      </div>
      {!dados.treinos && <section className="evolucao-card">
        <h2>Sem treinos neste período</h2><p>Os indicadores e o calendário são atualizados quando um treino é finalizado.</p>
        {!aluno && <Link className="portal-voltar" to="/aluno/treinos">Ver fichas de treino</Link>}
      </section>}
      <Metas dados={dados} aluno={aluno} />
      <section className="evolucao-card">
        <h2><Trophy size={20} aria-hidden="true" /> Cargas, repetições e recordes</h2>
        <p className="evolucao-texto-suave">O gráfico mostra as melhores marcas diárias no período. Os recordes consideram todo o histórico do exercício.</p>
        {!dados.pontos.length ? <p>Nenhuma série registrada neste período.</p> : <>
          <dl className="evolucao-recordes">
            <div><dt>Maior carga</dt><dd>{unidade.format(dados.melhor_carga)} kg</dd></div>
            <div><dt>Mais repetições em uma série</dt><dd>{dados.melhores_repeticoes}</dd></div>
          </dl>
          <div className="evolucao-graficos" key={dados.exercicio}>
            <Grafico dados={dados.pontos} campo="carga" titulo="Carga em kg" cor="var(--evolucao-acento)" />
            <Grafico dados={dados.pontos} campo="repeticoes" titulo="Repetições" cor="var(--evolucao-azul)" />
          </div>
          <details><summary>Ver valores dos gráficos</summary>
            <table><caption>Melhores marcas diárias</caption><thead><tr><th scope="col">Dia</th><th scope="col">Carga</th><th scope="col">Repetições</th></tr></thead>
              <tbody>{dados.pontos.map((item) => <tr key={item.dia}><td>{dataCurta(item.dia)}</td><td>{unidade.format(item.carga)} kg</td><td>{item.repeticoes}</td></tr>)}</tbody>
            </table>
          </details>
        </>}
      </section>
      <section className="evolucao-card">
        <h2><CalendarDays size={20} aria-hidden="true" /> Calendário de treinos</h2>
        <p className="evolucao-texto-suave">Os dias destacados têm pelo menos um treino finalizado.</p>
        <Calendario dados={dados} />
      </section>
      <section className="evolucao-card">
        <h2>Avaliações físicas</h2><p>Nenhuma avaliação física disponível para consulta no portal.</p>
      </section>
    </>}
  </section>;
}

const pontoEvolucao = PropTypes.shape({
  dia: PropTypes.string.isRequired,
  carga: PropTypes.number.isRequired,
  repeticoes: PropTypes.number.isRequired,
});

Grafico.propTypes = {
  dados: PropTypes.arrayOf(pontoEvolucao).isRequired,
  campo: PropTypes.oneOf(['carga', 'repeticoes']).isRequired,
  titulo: PropTypes.string.isRequired,
  cor: PropTypes.string.isRequired,
};

Calendario.propTypes = {
  dados: PropTypes.shape({
    calendario: PropTypes.arrayOf(PropTypes.shape({
      dia: PropTypes.string.isRequired, treinos: PropTypes.number.isRequired,
    })).isRequired,
    inicio: PropTypes.string.isRequired,
    fim: PropTypes.string.isRequired,
  }).isRequired,
};

Metas.propTypes = {
  dados: PropTypes.shape({
    objetivo: PropTypes.string,
    meta_semanal: PropTypes.number,
    treinos_semana: PropTypes.number.isRequired,
    segunda: PropTypes.string.isRequired,
  }).isRequired,
  aluno: PropTypes.string,
};

EvolucaoAluno.propTypes = { aluno: PropTypes.string };
