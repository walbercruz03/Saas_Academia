import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import api from '../api';
import ResumoExecucao from './ResumoExecucao';
import { dataTreino } from '../formatarExecucao';

export default function HistoricoExecucoesProfessor({ aluno }) {
  const [pagina,setPagina] = useState(1);
  const [dados,setDados] = useState(null);
  const [aberta,setAberta] = useState(null);
  const [sessao,setSessao] = useState(null);
  const [erro,setErro] = useState('');
  const [erroDetalhe,setErroDetalhe] = useState('');
  const [indisponivel,setIndisponivel] = useState(false);
  const rota = `/alunos/${aluno}/portal/execucoes`;

  useEffect(() => {
    const controle = new AbortController();
    api.get(rota,{ params:{ pagina },signal:controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) setDados(data);
    }).catch((falha) => {
      if (controle.signal.aborted) return;
      if ([403,404,503].includes(falha.response?.status)) setIndisponivel(true);
      else setErro('Não foi possível carregar as execuções do portal.');
    });
    return () => controle.abort();
  },[rota,pagina]);

  useEffect(() => {
    if (!aberta) return;
    const controle = new AbortController();
    api.get(rota + '/' + aberta,{ signal:controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) setSessao(data);
    }).catch(() => {
      if (!controle.signal.aborted) setErroDetalhe('Não foi possível carregar os registros da sessão.');
    });
    return () => controle.abort();
  },[rota,aberta]);

  function selecionar(id) {
    setSessao(null);
    setErroDetalhe('');
    setAberta((anterior) => anterior === id ? null : id);
  }

  function irPara(valor) {
    setDados(null);
    setErro('');
    setAberta(null);
    setPagina(valor);
  }

  if (indisponivel) return null;
  return <section className="form-card" aria-labelledby="historico-portal-prof-titulo">
    <h3 id="historico-portal-prof-titulo"><History size={19} aria-hidden="true" /> Sessões do Portal do Aluno</h3>
    {erro && <p className="msg-erro" role="alert">{erro}</p>}
    {!dados && !erro && <p role="status">Carregando sessões do portal…</p>}
    {dados?.historico.length === 0 && <p>Nenhuma sessão finalizada nesta página.</p>}
    {dados?.historico.map((execucao) => (
      <article className="treinamento-item-box" key={execucao.id}>
        <h4>{execucao.nome}</h4><p>{dataTreino(execucao.finalizado_em)}</p>
        <ResumoExecucao sessao={execucao} />
        <button className="treinamento-btn treinamento-btn--neutro" type="button"
          aria-expanded={aberta === execucao.id} onClick={() => selecionar(execucao.id)}>
          {aberta === execucao.id ? 'Fechar séries' : 'Ver séries'}
        </button>
        {aberta === execucao.id && <>
          {erroDetalhe && <p className="msg-erro" role="alert">{erroDetalhe}</p>}
          {!sessao && !erroDetalhe && <p role="status">Carregando séries…</p>}
          {sessao && <ResumoExecucao sessao={sessao} detalhado somenteSeries />}
        </>}
      </article>
    ))}
    {dados && (pagina > 1 || dados.tem_mais) && <div className="btn-grupo">
      <button className="treinamento-btn treinamento-btn--neutro" type="button" disabled={pagina === 1} onClick={() => irPara(pagina-1)}>Anterior</button>
      <button className="treinamento-btn treinamento-btn--neutro" type="button" disabled={!dados.tem_mais} onClick={() => irPara(pagina+1)}>Próxima</button>
    </div>}
  </section>;
}

HistoricoExecucoesProfessor.propTypes = { aluno: PropTypes.string.isRequired };
