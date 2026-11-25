import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { Building2, Users, ShieldCheck, CreditCard, SlidersHorizontal, LockKeyhole } from 'lucide-react';
import '../styles/configuracoes.css';
import api from '../api';
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
      <button type="button" className="relatorios-btn" disabled={pagina === 1}
        onClick={() => setPagina(pagina - 1)}>Anterior</button>
      <button type="button" className="relatorios-btn" disabled={!resultado.temMais}
        onClick={() => setPagina(pagina + 1)}>Próxima</button>
    </nav>}
  </>;
}

function Descricao({ itens }) {
  return <dl className="config-dados">{itens.map(([rotulo, valor]) => <div key={rotulo}>
    <dt>{rotulo}</dt><dd>{valor ?? '—'}</dd>
  </div>)}</dl>;
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
      <button className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>Salvar permissões</button>
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
        <button type="submit" className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>Confirmar forma de pagamento</button>
      </form>
    )}
    {link && <p><a href={link} target="_blank" rel="noreferrer">Abrir Checkout Sandbox</a></p>}
    {dados.sandbox && <button type="button" className="relatorios-btn" disabled={ocupado} onClick={async () => {
      try { setFaturas((await api.get('/configuracoes/assinatura/sandbox')).data.cobrancas); }
      catch (falha) { setMensagem(falha.response?.data?.mensagem || 'Não foi possível consultar o Sandbox.'); }
    }}>Consultar pagamentos Sandbox</button>}
    {faturas && <ul>{faturas.map((p) => <li key={p.id}>{dataCivil(p.vencimento)} · {moeda(p.valor_centavos)} · {p.status}
      {p.fatura_url && <>{' '}<a href={p.fatura_url} target="_blank" rel="noreferrer">Abrir fatura</a></>}
    </li>)}</ul>}
    <button type="button" className="relatorios-btn" disabled={ocupado} onClick={() => {
      if (window.confirm('Cancelar a renovação da assinatura? Você mantém o acesso durante o período vigente.')) executar('cancelar');
    }}>{controle.cancelamento_solicitado_em ? 'Consultar cancelamento' : 'Cancelar assinatura'}</button>
    {mensagem && <p role="status">{mensagem}</p>}
  </>;
}

export default function ConfiguracoesAcademia() {
  const { usuario, logout } = useAuth();
  const { secao = 'dados' } = useParams();
  const [versaoAssinatura, setVersaoAssinatura] = useState(0);
  if (usuario?.cargo !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!secoes.some(([id]) => id === secao)) return <Navigate to="/configuracoes/dados" replace />;

  return <div className="container config-academia">
    <h1>Configurações da academia</h1>
    <p className="config-subtitulo">Gerencie os dados, acessos e preferências da sua academia.</p>
    <nav className="config-abas" aria-label="Configurações da academia">
      {secoes.map(([id, rotulo, Icon]) => <NavLink key={id} to={`/configuracoes/${id}`}
        className={({ isActive }) => `config-aba ${isActive || secao === id ? 'config-aba-ativa' : ''}`}><Icon size={19} strokeWidth={1.8} aria-hidden="true" />{rotulo}</NavLink>)}
    </nav>
    <section className="form-card config-painel" aria-labelledby="configuracoes-titulo">
      <h2 id="configuracoes-titulo">{secoes.find(([id]) => id === secao)[1]}</h2>
      {secao === 'dados' && <Consulta key="dados" secao="dados">{(d) => <Descricao itens={[
        ['Nome fantasia', d.nome_fantasia || d.nome], ['Razão social', d.razao_social],
        ['CPF ou CNPJ', d.documento_mascarado], ['Telefone', d.telefone], ['E-mail de contato', d.email],
        ['Endereço', [d.logradouro, d.numero_endereco, d.complemento, d.bairro, d.cidade, d.uf, d.cep]
          .filter(Boolean).join(', ') || d.endereco],
      ]} />}</Consulta>}
      {secao === 'usuarios' && <Link to="/professores">Gerenciar professores</Link>}
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
      {secao === 'preferencias' && <Link to="/checkin">Configurar política de inadimplência no check-in</Link>}
      {secao === 'seguranca' && <button type="button" className="relatorios-btn" onClick={logout}>Sair desta sessão</button>}
    </section>
  </div>;
}
