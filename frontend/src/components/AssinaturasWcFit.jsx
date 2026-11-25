import { useEffect, useRef, useState } from 'react';
import { solicitar } from '../apiSuperAdmin';

export const moedaComercial = (valor) => valor == null ? '—' :
  (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const situacoes = {
  excluida: 'Encerrada por exclusão da academia',
  transicao: 'Em transição', teste_gratuito: 'Teste gratuito', ativa: 'Ativa',
  inadimplente: 'Inadimplente', cortesia: 'Cortesia',
};
const dataCivil = (data) => data ? data.split('-').reverse().join('/') : '—';
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza' });
const chaveNova = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2,'0')).join('');

function CobrancasSandbox({ academiaId, sessaoEncerrada }) {
  const [aberto, setAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [assinatura, setAssinatura] = useState('');
  const [resultado, setResultado] = useState(null);
  const [conciliando, setConciliando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  useEffect(() => {
    if (!aberto) return;
    const controle = new AbortController();
    setResultado(null);
    solicitar(`assinaturas/${academiaId}/asaas-sandbox?${new URLSearchParams({ pagina, assinatura })}`, null, controle.signal)
      .then(setResultado)
      .catch((erro) => {
        if (controle.signal.aborted) return;
        if (erro.status === 401) sessaoEncerrada();
        else setResultado({ erro: erro.message });
      });
    return () => controle.abort();
  }, [aberto, academiaId, pagina, assinatura, sessaoEncerrada]);

  async function conciliar() {
    if (conciliando) return;
    setConciliando(true);
    setMensagem('');
    try {
      setResultado(await solicitar(`assinaturas/${academiaId}/asaas-sandbox/conciliar`,
        { pagina, assinatura: resultado.assinatura_id }));
      setMensagem('Página conciliada no Sandbox.');
    } catch (erro) {
      if (erro.status === 401) sessaoEncerrada();
      else setMensagem(erro.message);
    } finally {
      setConciliando(false);
    }
  }

  return <details onToggle={(evento) => setAberto(evento.currentTarget.open)}>
    <summary>Cobranças Asaas Sandbox</summary>
    {aberto && !resultado && <p role="status">Consultando cobranças…</p>}
    {resultado?.erro && <p role="alert">{resultado.erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    {resultado?.cobrancas && <>
      {resultado.assinaturas?.length > 1 && (
        <label>Recorrência Sandbox{' '}
          <select className="relatorios-select" value={resultado.assinatura_id} disabled={conciliando}
            onChange={(evento) => { setAssinatura(evento.target.value); setPagina(1); setMensagem(''); }}>
            {resultado.assinaturas.map((item) => <option value={item.id} key={item.id}>#{item.id} · {item.estado}</option>)}
          </select>
        </label>
      )}
      {resultado.cobrancas.length ? <ul>{resultado.cobrancas.map((item) => <li key={item.id}>
        {dataCivil(item.vencimento)} · {moedaComercial(item.valor_centavos)} · {item.status}
        {item.estornado_centavos > 0 && ` · Estorno: ${moedaComercial(item.estornado_centavos)}`}
        {item.recebimento_manual_mes && ' · Competência com recebimento manual'}
        {item.fatura_url && <>{' · '}<a href={item.fatura_url} target="_blank" rel="noreferrer">Fatura Sandbox</a></>}
      </li>)}</ul> : <p>Nenhuma cobrança Sandbox.</p>}
      <button type="button" className="relatorios-btn" disabled={conciliando || pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
      <button type="button" className="relatorios-btn" disabled={conciliando || !resultado.temMais} onClick={() => setPagina(pagina + 1)}>Próxima</button>
      {resultado.assinatura_id && <button type="button" className="relatorios-btn" disabled={conciliando}
        onClick={conciliar}>Conciliar página</button>}
    </>}
  </details>;
}

export default function AssinaturasWcFit({ dados, versao, mudarPagina, atualizar, sessaoEncerrada, academiaInicial }) {
  const [busca, setBusca] = useState('');
  const [id, setId] = useState(academiaInicial);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [detalhe, setDetalhe] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [permanente, setPermanente] = useState(false);
  const envio = useRef(false);
  const recibo = useRef(null);

  useEffect(() => {
    if (!id) return;
    const consulta = new AbortController();
    setDetalhe(null);
    solicitar(`assinaturas/${id}?pagina=${paginaHistorico}`, null, consulta.signal)
      .then(setDetalhe)
      .catch((falha) => {
        if (consulta.signal.aborted) return;
        if (falha.status === 401) sessaoEncerrada();
        else setErro(falha.message);
      });
    return () => consulta.abort();
  }, [id, paginaHistorico, versao, sessaoEncerrada]);

  async function executar(caminho, corpo, retorno, chave) {
    if (envio.current) return false;
    envio.current = true;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      await solicitar(caminho, corpo, undefined, chave);
      setMensagem(retorno);
      atualizar();
      return true;
    } catch (falha) {
      if (falha.status === 401) sessaoEncerrada();
      else {
        setErro(falha.message);
        if (caminho.includes('/asaas-sandbox/')) atualizar();
      }
      return false;
    } finally {
      envio.current = false;
      setOcupado(false);
    }
  }

  function preco(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const valor = Number(new FormData(formulario).get('preco'));
    executar('assinaturas/precos', { valor_centavos: Math.round(valor * 100) }, 'Preço atualizado para novas contratações.')
      .then((ok) => { if (ok) formulario.reset(); });
  }

  function operar(evento, acao) {
    evento.preventDefault();
    const campos = Object.fromEntries(new FormData(evento.currentTarget));
    if (acao === 'conceder') campos.ate = permanente ? null : campos.ate;
    const mensagens = { conceder:'Cortesia registrada.', revogar:'Cortesia encerrada.', receber:'Recebimento registrado.' };
    let chave;
    if (acao === 'receber') {
      campos.competencia = detalhe.academia.proximo_vencimento;
      const identidade = JSON.stringify([id, campos]);
      if (recibo.current?.identidade !== identidade) recibo.current = { identidade, chave: chaveNova() };
      chave = recibo.current.chave;
    }
    executar(`assinaturas/${id}/${acao}`, campos, mensagens[acao], chave);
  }

  const academia = detalhe?.academia;
  const sandbox = detalhe?.asaasSandbox;
  const situacaoSandbox = sandbox?.assinatura?.estado;
  return (
    <>
      {erro && <p role="alert" className="relatorio-aviso-box">{erro}</p>}
      {mensagem && <p role="status" className="relatorio-aviso-box">{mensagem}</p>}
      {dados && <>
        <form className="relatorios-controles sa-filtros" onSubmit={(evento) => {
          evento.preventDefault();
          mudarPagina(1,busca.trim());
        }}>
          <label>Academia
            <input type="search" className="relatorios-select" value={busca} maxLength={160}
              onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome ou ID" />
          </label>
          <button className="relatorios-btn relatorios-btn-primario">Filtrar</button>
        </form>
        <div className="relatorio-tabela-wrapper sa-tabela">
          <table className="relatorio-tabela">
            <thead><tr><th>Academia</th><th>Situação comercial</th><th>Mensalidade</th><th>Vencimento</th><th>Ações</th></tr></thead>
            <tbody>{dados.registros.map((item) => <tr key={item.id}>
              <th scope="row">{item.nome} · #{item.id}</th>
              <td>{situacoes[item.situacao]}</td><td>{moedaComercial(item.mensalidade_centavos)}</td>
              <td>{dataCivil(item.proximo_vencimento)}</td>
              <td><button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={() => {
                setId(item.id); setPaginaHistorico(1); setErro(''); setPermanente(false);
              }}>Gerenciar</button></td>
            </tr>)}</tbody>
          </table>
          {!dados.registros.length && <p className="relatorio-vazio">Nenhuma academia encontrada.</p>}
        </div>
        <div className="btn-grupo">
          <button type="button" className="relatorios-btn" disabled={dados.pagina <= 1} onClick={() => mudarPagina(dados.pagina - 1)}>Anterior</button>
          <button type="button" className="relatorios-btn" disabled={!dados.temMais} onClick={() => mudarPagina(dados.pagina + 1)}>Próxima</button>
        </div>
        <details className="form-card">
          <summary>Preços e histórico</summary>
          <form className="relatorios-controles sa-filtros" onSubmit={preco}>
            <label>Mensalidade para novos contratos (R$)
              <input className="relatorios-select" type="number" name="preco" required min="0.01" max="21474836.47" step="0.01" />
            </label>
            <button className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>Salvar preço</button>
          </form>
          <ul>{dados.precos.map((item, indice) => <li key={item.id}>
            {moedaComercial(item.valor_centavos)} · {dataHora.format(new Date(item.vigente_desde))}{indice === 0 && ' (atual)'}
          </li>)}</ul>
        </details>
      </>}
      {academia && <section className="form-card" aria-label="Gestão da assinatura">
        <h2>{academia.nome} · #{academia.id}</h2>
        <p>{situacoes[academia.situacao]} · {moedaComercial(academia.mensalidade_centavos)}</p>
        {academia.situacao === 'excluida' ? <p>Histórico comercial preservado.</p> : academia.situacao === 'transicao' ? (
          <button type="button" className="relatorios-btn relatorios-btn-primario" disabled={ocupado}
            onClick={() => executar(`assinaturas/${id}/iniciar`, {}, 'Teste gratuito iniciado.')}>
            Iniciar teste gratuito de 30 dias
          </button>
        ) : <>
          <p>Fim do teste gratuito: {dataCivil(academia.fim_teste)} · Vencimento: {dataCivil(academia.proximo_vencimento)}</p>
          {sandbox && <details>
            <summary>Gerenciar Asaas Sandbox</summary>
            <p>Use documentos sintéticos. Valores Sandbox são apenas para teste.</p>
            {sandbox.cliente?.estado !== 'vinculada' && <form className="relatorios-controles sa-filtros" onSubmit={(evento) => {
              evento.preventDefault();
              const documento = new FormData(evento.currentTarget).get('documento');
              executar(`assinaturas/${id}/asaas-sandbox/cliente`, documento ? { documento } : {}, 'Cliente Sandbox atualizado.');
            }}>
              {!sandbox.cliente && <label>CPF ou CNPJ sintético
                <input className="relatorios-select" name="documento" maxLength={18} required />
              </label>}
              <button className="relatorios-btn" disabled={ocupado}>{sandbox.cliente ? 'Conciliar cliente' : 'Criar cliente Sandbox'}</button>
            </form>}
            {sandbox.cliente?.estado === 'vinculada' && !['vinculada','cancelando'].includes(situacaoSandbox) &&
              (situacaoSandbox || ['ativa','inadimplente'].includes(academia.situacao)) && (
                <form className="relatorios-controles sa-filtros" onSubmit={(evento) => {
                  evento.preventDefault();
                  const meio = new FormData(evento.currentTarget).get('meio') || sandbox.assinatura?.meio;
                  executar(`assinaturas/${id}/asaas-sandbox/assinatura`, { meio }, 'Recorrência Sandbox atualizada.');
                }}>
                  {!situacaoSandbox && <label>Forma de pagamento Sandbox
                    <select className="relatorios-select" name="meio">
                      <option value="UNDEFINED">Escolher na fatura</option><option value="PIX">Pix</option>
                      <option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option>
                    </select>
                  </label>}
                  <button className="relatorios-btn" disabled={ocupado}>{situacaoSandbox ? 'Conciliar recorrência' : 'Criar recorrência Sandbox'}</button>
                </form>
              )}
            {['vinculada','cancelando'].includes(situacaoSandbox) && (
              <button type="button" className="relatorios-btn" disabled={ocupado} onClick={() =>
                executar(`assinaturas/${id}/asaas-sandbox/cancelar`, {}, 'Recorrência Sandbox encerrada.')}>
                {situacaoSandbox === 'cancelando' ? 'Confirmar encerramento Sandbox' : 'Encerrar recorrência Sandbox'}
              </button>
            )}
          </details>}
          {(sandbox?.historico || academia.asaas_sandbox_vinculado) && (
            <CobrancasSandbox key={id} academiaId={id} sessaoEncerrada={sessaoEncerrada} />
          )}
          {academia.situacao === 'cortesia' ? (
            <form className="relatorios-controles sa-filtros" onSubmit={(evento) => operar(evento, 'revogar')}>
              <p>{academia.cortesia_ate ? `Cortesia até ${dataCivil(academia.cortesia_ate)}` : 'Cortesia permanente'}</p>
              <label>Motivo do encerramento<input className="relatorios-select" name="motivo" required maxLength={240} /></label>
              <button className="relatorios-btn relatorios-btn-secundario" disabled={ocupado}>Encerrar cortesia</button>
            </form>
          ) : (
            <form className="relatorios-controles sa-filtros" onSubmit={(evento) => operar(evento, 'conceder')}>
              <label><input type="checkbox" checked={permanente} onChange={(evento) => setPermanente(evento.target.checked)} /> Cortesia permanente</label>
              {!permanente && <label>Cortesia até
                <input className="relatorios-select" type="date" name="ate" min={detalhe.hoje} max="9999-12-30" required />
              </label>}
              <label>Motivo da cortesia<input className="relatorios-select" name="motivo" required maxLength={240} /></label>
              <button className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>Conceder cortesia</button>
            </form>
          )}
          {['ativa','inadimplente'].includes(academia.situacao) && (
            <form className="relatorios-controles sa-filtros" onSubmit={(evento) => operar(evento, 'receber')}>
              <label>Recebido em
                <input className="relatorios-select" type="date" name="recebido_em" min={academia.fim_teste}
                  max={detalhe.hoje} defaultValue={detalhe.hoje} required />
              </label>
              <label>Referência do recebimento
                <input className="relatorios-select" name="referencia" maxLength={120} />
              </label>
              <button className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>Registrar {moedaComercial(academia.mensalidade_centavos)}</button>
            </form>
          )}
        </>}
        {academia.situacao !== 'transicao' && (
          <details>
            <summary>Histórico de cortesias e recebimentos</summary>
            <h3>Cortesias</h3>
            {detalhe.cortesias.length ? <ul>{detalhe.cortesias.map((item) => <li key={item.id}>
              {dataCivil(item.concedida_em)} · {item.ate ? `até ${dataCivil(item.ate)}` : 'permanente'} · {item.motivo}
              {item.revogada_em && ` · Encerrada em ${dataCivil(item.revogada_em)}: ${item.motivo_revogacao}`}
            </li>)}</ul> : <p>Nenhuma cortesia nesta página.</p>}
            <h3>Recebimentos</h3>
            {detalhe.recebimentos.length ? <ul>{detalhe.recebimentos.map((item) => <li key={item.id}>
              {dataCivil(item.recebido_em)} · {moedaComercial(item.valor_centavos)} · Vencimento {dataCivil(item.competencia)}
              {item.referencia && ` · ${item.referencia}`}
            </li>)}</ul> : <p>Nenhum recebimento nesta página.</p>}
            <button type="button" className="relatorios-btn" disabled={paginaHistorico <= 1} onClick={() => setPaginaHistorico(paginaHistorico - 1)}>Anterior</button>
            <button type="button" className="relatorios-btn" disabled={!detalhe.temMais} onClick={() => setPaginaHistorico(paginaHistorico + 1)}>Próxima</button>
          </details>
        )}
      </section>}
    </>
  );
}
