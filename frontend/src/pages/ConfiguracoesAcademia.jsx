import PropTypes from 'prop-types';
import LogotipoAcademia from '../components/LogotipoAcademia';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { Building2, Users, ShieldCheck, CreditCard, SlidersHorizontal, LockKeyhole, ArrowRight, ChevronLeft, ChevronRight, FileText, LogOut, Save, X } from 'lucide-react';
import '../styles/configuracoes.css';
import api from '../api';
import { useConsultaCep } from '../useConsultaCep';
import CamposCadastroAcademia from '../components/CamposCadastroAcademia';
import { useAuth } from '../contexts/AuthContext';

const secoes = [
  ['dados', 'Dados da academia', Building2], ['usuarios', 'Usuários e professores', Users],
  ['permissoes', 'Permissões de acesso', ShieldCheck], ['assinatura', 'Minha assinatura', CreditCard],
  ['preferencias', 'Preferências operacionais', SlidersHorizontal], ['seguranca', 'Segurança', LockKeyhole],
];
const situacoes = {
  transicao: 'Em transição', teste_gratuito: 'Período gratuito',
  ativa: 'Ativa', inadimplente: 'Em atraso', cortesia: 'Cortesia',
};
const dataCivil = (data) => data ? data.split('-').reverse().join('/') : '—';
const moeda = (valor) => valor == null ? '—' :
  (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Consulta({ secao, children, versao = 0 }) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    const controle = new AbortController();
    setResultado(null);
    setErro('');
    api.get(`/configuracoes/${secao}`, { params: { pagina }, signal: controle.signal })
      .then(({ data }) => { if (!controle.signal.aborted) setResultado(data); })
      .catch((falha) => {
        if (!controle.signal.aborted) setErro(falha.response?.data?.mensagem || 'Não foi possível carregar os dados.');
      });
    return () => controle.abort();
  }, [secao, pagina, versao]);

  if (erro) return <p role="alert">{erro}</p>;
  if (!resultado) return <p role="status">Carregando…</p>;
  return <>
    {children(resultado)}
    {(pagina > 1 || resultado.temMais) && <nav className="btn-grupo" aria-label="Páginas de pagamentos">
      <button type="button" className="treinamento-btn treinamento-btn--neutro" disabled={pagina === 1}
        onClick={() => setPagina(pagina - 1)}><ChevronLeft size={16} aria-hidden="true" /> Anterior</button>
      <button type="button" className="treinamento-btn treinamento-btn--neutro" disabled={!resultado.temMais}
        onClick={() => setPagina(pagina + 1)}>Próxima <ChevronRight size={16} aria-hidden="true" /></button>
    </nav>}
  </>;
}

function Descricao({ itens }) {
  return <dl className="config-dados">{itens.map(([rotulo, valor]) => <div key={rotulo}>
    <dt>{rotulo}</dt><dd>{valor ?? '—'}</dd>
  </div>)}</dl>;
}

function camposPerfil(academia) {
  return {
    nome_fantasia: academia.nome_fantasia || academia.nome,
    whatsapp_comercial: academia.telefone, numero: academia.numero_endereco,
    cep: academia.cep, logradouro: academia.logradouro, complemento: academia.complemento,
    bairro: academia.bairro, cidade: academia.cidade, uf: academia.uf,
  };
}

function PerfilAcademia({ academia, atualizar }) {
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(() => camposPerfil(academia));
  const avisoCep = useConsultaCep(dados, setDados, academia.cep?.replace(/\D/g, '') || '');
  async function salvar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      await api.put('/configuracoes/dados', dados);
      atualizar();
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível salvar os dados da academia.');
    } finally {
      setOcupado(false);
    }
  }
  return <>
    <Descricao itens={[
      ['Nome fantasia', academia.nome_fantasia || academia.nome], ['Razão social', academia.razao_social],
      ['CPF ou CNPJ', academia.documento_mascarado], ['Telefone', academia.telefone], ['E-mail de contato', academia.email],
      ['Endereço', [academia.logradouro, academia.numero_endereco, academia.complemento, academia.bairro,
        academia.cidade, academia.uf, academia.cep].filter(Boolean).join(', ') || academia.endereco],
    ]} />
    {editando ? <form onSubmit={salvar}>
      <fieldset className="form-grid" disabled={ocupado}>
        <legend>Editar nome, telefone e endereço comercial</legend>
        <CamposCadastroAcademia dados={dados} setDados={setDados} avisoCep={avisoCep} somentePerfil />
      </fieldset>
      {erro && <p className="msg-erro" role="alert">{erro}</p>}
      <div className="btn-grupo">
        <button type="button" className="treinamento-btn treinamento-btn--neutro" disabled={ocupado}
          onClick={() => { setEditando(false); setErro(''); setDados(camposPerfil(academia)); }}>Cancelar</button>
        <button className="treinamento-btn treinamento-btn--primario" disabled={ocupado}>
          <Save size={16} aria-hidden="true" /> {ocupado ? 'Salvando…' : 'Salvar dados'}
        </button>
      </div>
    </form> : <button type="button" className="treinamento-btn treinamento-btn--neutro"
      onClick={() => setEditando(true)}>Editar dados comerciais</button>}
    <LogotipoAcademia disponivel={academia.logotipo_disponivel} />
  </>;
}

function Permissoes({ professores, modulos, acoes }) {
  const [id, setId] = useState('');
  const [regras, setRegras] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [salvas, setSalvas] = useState({});
  const selecionar = (valor) => {
    setId(valor);
    setRegras(salvas[valor] ?? professores.find((p) => String(p.id) === valor)?.permissoes ?? {});
    setMensagem('');
  };
  async function salvar(evento) {
    evento.preventDefault();
    if (!window.confirm('Aplicar estas permissões ao professor selecionado?')) return;
    setOcupado(true);
    try {
      await api.put(`/configuracoes/permissoes/${id}`, { permissoes: regras });
      setSalvas({ ...salvas, [id]:regras });
      setMensagem('Permissões atualizadas.');
    } catch (falha) {
      setMensagem(falha.response?.data?.mensagem || 'Não foi possível salvar as permissões.');
    } finally {
      setOcupado(false);
    }
  }
  return <form onSubmit={salvar} className="campo">
    <label>Professor <select value={id} onChange={(e) => selecionar(e.target.value)} disabled={ocupado}>
      <option value="">Selecione</option>
      {professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select></label>
    {id && <>
      <p>Depois de salvar, somente as ações selecionadas ficam disponíveis. Ações reservadas ao administrador continuam protegidas.</p>
      {Object.entries(modulos).map(([modulo, rotulo]) => <fieldset key={modulo} disabled={ocupado}>
        <legend>{rotulo}</legend>
        {acoes[modulo].map((acao) => <label key={acao}>
          <input type="checkbox" checked={regras[modulo]?.includes(acao) ?? false}
            onChange={(e) => setRegras({ ...regras, [modulo]: e.target.checked
              ? [...regras[modulo] || [],acao] : regras[modulo].filter((valor) => valor !== acao) })} /> {acao}{' '}
        </label>)}
      </fieldset>)}
      <button className="treinamento-btn treinamento-btn--primario" disabled={ocupado}><Save size={16} aria-hidden="true" /> Salvar permissões</button>
    </>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}

function AcoesAssinatura({ dados, atualizar }) {
  const [meio, setMeio] = useState(dados.autogestao?.meio || 'PIX');
  const [meioAtual, setMeioAtual] = useState(dados.autogestao?.meio);
  const [documento, setDocumento] = useState('');
  const [link, setLink] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [faturas, setFaturas] = useState(null);
  const controle = dados.autogestao;

  async function executar(acao, corpo) {
    setOcupado(true);
    setMensagem('');
    try {
      const { data } = await api.post(`/configuracoes/assinatura/${acao}`, { ...corpo, confirmar:true });
      if (acao === 'cancelar') {
        setLink('');
        atualizar();
        return;
      }
      setLink(data.link || '');
      setMeioAtual(meio);
      setMensagem(data.estado === 'trial'
        ? 'Informe um documento fictício para concluir o agendamento no Sandbox.'
        : data.estado === 'agendada' ? `Pix agendado para ${dataCivil(data.primeiro_vencimento)}. Você paga cada fatura pelo QR Code.`
          : data.link ? `Autorize o cartão no Asaas Sandbox. Primeira cobrança em ${dataCivil(data.primeiro_vencimento)}.`
            : 'Assinatura Sandbox vinculada.');
    } catch (falha) {
      setMensagem(falha.response?.data?.mensagem || 'Não foi possível confirmar a operação.');
    } finally {
      setOcupado(false);
    }
  }

  if (controle === null || dados.plano == null) return null;
  if (controle.cancelado_em) return <p>Cancelada. Acesso até o fim do período vigente, com encerramento em {dataCivil(controle.acesso_ate)}.</p>;
  return <>
    {controle.cancelamento_solicitado_em && <p>Cancelamento solicitado. Confirme novamente para consultar a conciliação.</p>}
    {dados.sandbox && !controle.cancelamento_solicitado_em && dados.situacao !== 'cortesia' && (
      <form className="campo" onSubmit={(evento) => {
        evento.preventDefault();
        const trocar = Boolean(meioAtual && meioAtual !== meio);
        if (trocar && !window.confirm('Trocar a forma de pagamento? A recorrência anterior será encerrada antes de iniciar a nova.')) return;
        executar('contratar', { meio, preco:dados.mensalidade_centavos, trocar, ...(documento && { documento }) });
      }}>
        <label>Forma de pagamento Sandbox
          <select value={meio} onChange={(e) => setMeio(e.target.value)} disabled={ocupado}>
            <option value="PIX">Pix convencional</option><option value="CREDIT_CARD">Cartão recorrente</option>
          </select>
        </label>
        <p>{meio === 'PIX' ? 'Você paga cada cobrança pelo QR Code. Pix Automático exige autorização bancária separada e está indisponível aqui.'
          : 'Autorize no ambiente do Asaas. A primeira cobrança é agendada para depois do período gratuito.'}</p>
        <label>CPF ou CNPJ fictício (se o cliente ainda não estiver vinculado ao Sandbox)
          <input value={documento} onChange={(e) => setDocumento(e.target.value)} maxLength={18} disabled={ocupado} />
        </label>
        <label><input type="checkbox" required /> Autorizo a contratação por {moeda(dados.mensalidade_centavos)}/mês neste ambiente de teste.</label>
        <button type="submit" className="treinamento-btn treinamento-btn--primario" disabled={ocupado}><CreditCard size={16} aria-hidden="true" /> Confirmar forma de pagamento</button>
      </form>
    )}
    {link && <p><a href={link} target="_blank" rel="noreferrer">Abrir Checkout Sandbox</a></p>}
    {dados.sandbox && <button type="button" className="treinamento-btn treinamento-btn--neutro" disabled={ocupado} onClick={async () => {
      try { setFaturas((await api.get('/configuracoes/assinatura/sandbox')).data.cobrancas); }
      catch (falha) { setMensagem(falha.response?.data?.mensagem || 'Não foi possível consultar o Sandbox.'); }
    }}><FileText size={16} aria-hidden="true" /> Consultar pagamentos Sandbox</button>}
    {faturas && <ul>{faturas.map((p) => <li key={p.id}>{dataCivil(p.vencimento)} · {moeda(p.valor_centavos)} · {p.status}
      {p.fatura_url && <>{' '}<a href={p.fatura_url} target="_blank" rel="noreferrer">Abrir fatura</a></>}
    </li>)}</ul>}
    <button type="button" className="treinamento-btn treinamento-btn--neutro" disabled={ocupado} onClick={() => {
      if (window.confirm('Cancelar a renovação da assinatura? Você mantém o acesso durante o período vigente.')) executar('cancelar');
    }}><X size={16} aria-hidden="true" /> {controle.cancelamento_solicitado_em ? 'Consultar cancelamento' : 'Cancelar assinatura'}</button>
    {mensagem && <p role="status">{mensagem}</p>}
  </>;
}

export default function ConfiguracoesAcademia() {
  const { usuario, logout } = useAuth();
  const { secao = 'dados' } = useParams();
  const [versaoDados, setVersaoDados] = useState(0);
  const [versaoAssinatura, setVersaoAssinatura] = useState(0);
  if (usuario?.cargo !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!secoes.some(([id]) => id === secao)) return <Navigate to="/configuracoes/dados" replace />;

  return <div className="page-container config-academia">
    <header className="page-header">
      <div>
        <h1>Configurações da academia</h1>
        <p>Gerencie os dados, acessos e preferências da sua academia.</p>
      </div>
    </header>
    <nav className="config-abas" aria-label="Configurações da academia">
      {secoes.map(([id, rotulo, Icon]) => <NavLink key={id} to={`/configuracoes/${id}`}
        className={({ isActive }) => `config-aba ${isActive || secao === id ? 'config-aba-ativa' : ''}`} aria-current={secao === id ? 'page' : undefined}><Icon size={19} strokeWidth={1.8} aria-hidden="true" />{rotulo}</NavLink>)}
    </nav>
    <section className="form-card config-painel" aria-labelledby="configuracoes-titulo">
      <h2 id="configuracoes-titulo">{secoes.find(([id]) => id === secao)[1]}</h2>
      {secao === 'dados' && <>
        {versaoDados > 0 && <p className="msg-sucesso" role="status">Dados da academia atualizados.</p>}
        <Consulta key="dados" secao="dados" versao={versaoDados}>{(dados) => (
          <PerfilAcademia key={versaoDados} academia={dados} atualizar={() => setVersaoDados((v) => v + 1)} />
        )}</Consulta>
      </>}
      {secao === 'usuarios' && <Link to="/professores" className="treinamento-btn treinamento-btn--neutro">Gerenciar professores <ArrowRight size={16} aria-hidden="true" /></Link>}
      {secao === 'permissoes' && <Consulta key="permissoes" secao="permissoes">{(dados) => <Permissoes {...dados} />}</Consulta>}
      {secao === 'assinatura' && <Consulta key="assinatura" secao="assinatura" versao={versaoAssinatura}>{(d) => <>
        <Descricao itens={[
          ['Plano', d.plano], ['Preço contratado', moeda(d.mensalidade_centavos)],
          ['Situação', situacoes[d.situacao] || d.situacao],
          ['Dias gratuitos restantes', d.dias_gratuitos], ['Próximo vencimento', dataCivil(d.proximo_vencimento)],
          ...(d.cortesia_ate ? [['Cortesia até', dataCivil(d.cortesia_ate)]] : []),
        ]} />
        <AcoesAssinatura dados={d} atualizar={() => setVersaoAssinatura((v) => v+1)} />
        <h3>Pagamentos registrados</h3>
        {d.pagamentos.length ? <ul>{d.pagamentos.map((p) => <li key={p.id}>
          {dataCivil(p.recebido_em)} · {moeda(p.valor_centavos)} · Vencimento {dataCivil(p.competencia)}
        </li>)}</ul> : <p>Nenhum pagamento registrado nesta página.</p>}
      </>}</Consulta>}
      {secao === 'preferencias' && <Link to="/checkin" className="treinamento-btn treinamento-btn--neutro">Configurar política de inadimplência no check-in <ArrowRight size={16} aria-hidden="true" /></Link>}
      {secao === 'seguranca' && <button type="button" className="treinamento-btn treinamento-btn--neutro" onClick={logout}><LogOut size={16} aria-hidden="true" /> Sair desta sessão</button>}
    </section>
  </div>;
}

Consulta.propTypes = {
  secao: PropTypes.string.isRequired, children: PropTypes.func.isRequired, versao: PropTypes.number,
};
Descricao.propTypes = { itens: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.node)).isRequired };
PerfilAcademia.propTypes = {
  academia: PropTypes.shape({
    nome: PropTypes.string, nome_fantasia: PropTypes.string, razao_social: PropTypes.string,
    documento_mascarado: PropTypes.string, telefone: PropTypes.string, email: PropTypes.string,
    logradouro: PropTypes.string, numero_endereco: PropTypes.string, complemento: PropTypes.string,
    bairro: PropTypes.string, cidade: PropTypes.string, uf: PropTypes.string, cep: PropTypes.string,
    endereco: PropTypes.string, logotipo_disponivel: PropTypes.bool,
  }).isRequired,
  atualizar: PropTypes.func.isRequired,
};
Permissoes.propTypes = {
  professores: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired, nome: PropTypes.string.isRequired,
    permissoes: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)),
  })).isRequired,
  modulos: PropTypes.objectOf(PropTypes.string).isRequired,
  acoes: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
};
AcoesAssinatura.propTypes = {
  dados: PropTypes.shape({
    autogestao: PropTypes.shape({
      meio: PropTypes.string, cancelado_em: PropTypes.string, acesso_ate: PropTypes.string,
      cancelamento_solicitado_em: PropTypes.string,
    }),
    plano: PropTypes.string, sandbox: PropTypes.bool, situacao: PropTypes.string,
    mensalidade_centavos: PropTypes.number,
  }).isRequired,
  atualizar: PropTypes.func.isRequired,
};
