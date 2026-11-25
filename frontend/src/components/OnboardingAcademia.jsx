import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Check, ClipboardList, CreditCard, Dumbbell, Image, ListChecks,
  ShieldCheck, UserRoundCheck, Users, X,
} from 'lucide-react';
import api from '../api';
import '../styles/onboarding.css';

const etapas = [
  ['perfil', Building2, 'Completar dados da academia', 'Confira nome, telefone e endereço comercial.', '/configuracoes/dados'],
  ['logotipo', Image, 'Adicionar logotipo', 'Envie a marca da academia na página de dados.', '/configuracoes/dados#logotipo-academia'],
  ['plano', ClipboardList, 'Cadastrar o primeiro plano', 'Defina o valor e a duração para usar na matrícula.', '/planos'],
  ['professor', UserRoundCheck, 'Cadastrar o primeiro professor', 'Crie o acesso da equipe na área de professores.', '/professores'],
  ['aluno', Users, 'Cadastrar o primeiro aluno', 'Crie o cadastro que será vinculado à matrícula e à ficha.', '/alunos'],
  ['matricula', ClipboardList, 'Realizar a primeira matrícula', 'Vincule um aluno a um plano já cadastrado.', '/matriculas'],
  ['treino', Dumbbell, 'Criar a primeira ficha de treino', 'Selecione um aluno e adicione os exercícios.', '/treinos'],
  ['permissoes', ShieldCheck, 'Configurar permissões de professores', 'Salve o primeiro conjunto de acessos de um professor.', '/configuracoes/permissoes'],
  ['assinatura', CreditCard, 'Configurar assinatura comercial', 'Consulte a oferta e configure a forma de pagamento disponível.', '/configuracoes/assinatura'],
];

function lerPreferencia(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export default function OnboardingAcademia({ usuario }) {
  const chave = `wcfit:onboarding:v1:${usuario.academia_id}:${usuario.id}`;
  const [preferencia, setPreferencia] = useState(() => lerPreferencia(chave));
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [consulta, setConsulta] = useState(0);
  const tituloGuia = useRef(null);

  useEffect(() => {
    let controle;
    function carregar() {
      controle?.abort();
      const atual = new AbortController();
      controle = atual;
      setErro(false);
      api.get('/configuracoes/onboarding', { signal: atual.signal })
        .then(({ data }) => {
          if (!atual.signal.aborted) setDados(data);
        })
        .catch(() => {
          if (!atual.signal.aborted) setErro(true);
        });
    }
    carregar();
    window.addEventListener('focus', carregar);
    return () => {
      controle?.abort();
      window.removeEventListener('focus', carregar);
    };
  }, [consulta]);

  function atualizarPreferencia(valor) {
    setPreferencia(valor);
    try {
      localStorage.setItem(chave, valor);
    } catch {
      // A orientação continua utilizável sem armazenamento persistente.
    }
    requestAnimationFrame(() => tituloGuia.current?.focus());
  }

  if (!dados) {
    return erro ? <section className="form-card onboarding-indisponivel" aria-label="Guia de configuração">
      <p role="status">O guia de configuração está indisponível.</p>
      <button type="button" className="btn-outline" onClick={() => setConsulta((v) => v + 1)}>Tentar novamente</button>
    </section> : null;
  }

  const realizadas = etapas.filter(([id]) => dados.etapas[id] === true).length;
  const tudoConcluido = realizadas === etapas.length;
  const assinaturaExternaPendente = !dados.etapas.assinatura && !dados.sandbox && realizadas === etapas.length - 1;
  const aberto = preferencia === 'aberto' || (!preferencia && dados.mostrar_boas_vindas);
  const dias = dados.dias_gratuitos;

  return <section className={`form-card onboarding ${aberto ? 'onboarding-aberto' : ''}`} aria-labelledby="onboarding-titulo">
    <div className="onboarding-cabecalho">
      <div className="onboarding-titulo">
        <ListChecks size={25} aria-hidden="true" />
        <div>
          <h3 id="onboarding-titulo" ref={tituloGuia} tabIndex={-1}>{aberto ? `Boas-vindas, ${dados.nome}!` : 'Guia de configuração'}</h3>
          <p>{aberto ? 'Acompanhe a configuração da sua academia no Wc Fit.' : `${realizadas} de ${etapas.length} etapas concluídas`}</p>
        </div>
      </div>
      {dias > 0 && <span className="onboarding-teste">
        {dias === 1 ? '1 dia restante no período gratuito' : `${dias} dias restantes no período gratuito`}
      </span>}
      {!aberto && <button type="button" className="treinamento-btn treinamento-btn--neutro"
        onClick={() => atualizarPreferencia('aberto')}>
        {preferencia === 'dispensado' ? 'Retomar orientação' : 'Ver orientação'}
      </button>}
    </div>

    {aberto && <>
      <div className="onboarding-progresso">
        <label htmlFor="onboarding-barra">{realizadas} de {etapas.length} etapas concluídas</label>
        <progress id="onboarding-barra" value={realizadas} max={etapas.length} />
      </div>
      {erro && <p className="onboarding-aviso" role="status">
        Exibindo a última consulta. <button type="button" onClick={() => setConsulta((v) => v + 1)}>Atualizar progresso</button>
      </p>}
      <ol className="onboarding-etapas">
        {etapas.map(([id, Icone, titulo, dica, destino]) => {
          const feita = dados.etapas[id] === true;
          const pendente = !feita && ((id === 'assinatura' && !dados.sandbox) || (id === 'logotipo' && !dados.logotipo_disponivel));
          return <li key={id}>
            <span className={feita ? 'onboarding-icone feita' : 'onboarding-icone'}>
              {feita ? <Check size={20} aria-hidden="true" /> : <Icone size={20} aria-hidden="true" />}
            </span>
            <div>
              <h4>{titulo}</h4>
              <p>{pendente ? (id === 'assinatura' ? 'A configuração de pagamento está indisponível neste ambiente.' : 'O envio de logotipo está indisponível neste ambiente.') : dica}</p>
            </div>
            {feita ? <span className="onboarding-etapa-status">Concluída</span> : <Link
              className="treinamento-btn treinamento-btn--neutro treinamento-btn--sm"
              aria-label={titulo} to={destino}>Abrir</Link>}
          </li>;
        })}
      </ol>
      <div className="onboarding-rodape">
        {assinaturaExternaPendente && <p>A orientação pode ser concluída. A configuração da assinatura continuará pendente.</p>}
        <button type="button" className="treinamento-btn treinamento-btn--neutro"
          onClick={() => atualizarPreferencia('dispensado')}><X size={16} aria-hidden="true" /> Dispensar orientação</button>
        {(tudoConcluido || assinaturaExternaPendente) && <button disabled={erro} type="button"
          className="treinamento-btn treinamento-btn--primario" onClick={() => atualizarPreferencia('concluido')}>
          <Check size={16} aria-hidden="true" /> Concluir orientação
        </button>}
      </div>
    </>}
  </section>;
}

OnboardingAcademia.propTypes = {
  usuario: PropTypes.shape({
    academia_id: PropTypes.number.isRequired,
    id: PropTypes.number.isRequired,
  }).isRequired,
};
