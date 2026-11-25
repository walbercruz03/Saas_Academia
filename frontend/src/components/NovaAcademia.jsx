import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { solicitar } from '../apiSuperAdmin';
import { useConsultaCep } from '../useConsultaCep';
import CamposCadastroAcademia from './CamposCadastroAcademia';
import { moedaComercial } from '../moedaComercial';

const chaveNova = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),
  (byte) => byte.toString(16).padStart(2, '0')).join('');
const campos = ['nome_fantasia', 'razao_social', 'tipo', 'documento', 'whatsapp_comercial', 'cep',
  'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'responsavel_nome', 'email', 'responsavel_whatsapp'];
const rotulos = {
  nome_fantasia: 'Nome fantasia', razao_social: 'Razão social', tipo: 'Tipo', documento: 'CPF ou CNPJ',
  whatsapp_comercial: 'WhatsApp comercial', endereco: 'Endereço', cep: 'CEP', logradouro: 'Logradouro',
  numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade', uf: 'UF',
  responsavel_nome: 'Responsável', email: 'E-mail do responsável', responsavel_whatsapp: 'Telefone do responsável',
  termos_aceitos_url: 'Termos aceitos', privacidade_aceita_url: 'Política de privacidade aceita',
};

export default function NovaAcademia({ selecao, fechar, confirmar, sessaoEncerrada }) {
  const { academia, acao = 'criar' } = selecao || {};
  const id = academia?.id;
  const titulo = { criar: 'Nova Academia', dados: 'Dados cadastrais', editar: 'Editar academia' }[acao];
  const endpoint = id ? `academias/${id}/dados` : 'academias/novo-cadastro';
  const dialogo = useRef(null);
  const envio = useRef(false);
  const tentativa = useRef(null);
  const [dados, setDados] = useState({ tipo: 'mei' });
  const [cepInicial, setCepInicial] = useState('');
  const [carregado, setCarregado] = useState(null);
  const [etapa, setEtapa] = useState(0);
  const [condicao, setCondicao] = useState({ tipo: 'teste', convite: true, ativar: false });
  const [permanente, setPermanente] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [totp, setTotp] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [link, setLink] = useState('');
  const [copiado, setCopiado] = useState(false);
  const avisoCep = useConsultaCep(acao === 'dados' ? {} : dados, setDados, cepInicial);

  useEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    return () => elemento.close();
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    solicitar(endpoint, {}, controle.signal).then((resultado) => {
      setCepInicial((resultado.cep || '').replace(/\D/g, ''));
      setDados({ ...resultado, tipo: resultado.tipo || 'mei' });
      setCarregado(resultado);
    }).catch((falha) => {
      if (controle.signal.aborted) return;
      if (falha.status === 401) sessaoEncerrada();
      else if (falha.status === 428) setTotp(true);
      else setErro(falha.message);
    });
    return () => controle.abort();
  }, [endpoint, sessaoEncerrada]);

  async function enviar(evento) {
    evento.preventDefault();
    if (envio.current) return;
    if (!totp && etapa < 2) {
      setEtapa(etapa + 1);
      return;
    }
    envio.current = true;
    setOcupado(true);
    setErro('');
    try {
      if (totp) {
        await solicitar('auth/totp-recente', { codigo });
        setTotp(false);
        setCodigo('');
      }
      if (!carregado) {
        const resultado = await solicitar(endpoint, {});
        setCepInicial((resultado.cep || '').replace(/\D/g, ''));
        setDados({ ...resultado, tipo: resultado.tipo || 'mei' });
        setCarregado(resultado);
        return;
      }
      if (!tentativa.current) {
        const cadastro = Object.fromEntries(campos.filter((campo) => dados[campo] != null)
          .map((campo) => [campo, dados[campo]]));
        const comercial = { ...condicao, preco: carregado.mensalidade_centavos,
          ate: permanente ? null : condicao.ate };
        tentativa.current = { chave: chaveNova(), corpo: id ? { cadastro, confirmar: true } : { cadastro, condicao: comercial } };
      }
      const { chave, corpo } = tentativa.current;
      const resultado = await solicitar(id ? `academias/${id}/editar` : 'academias/cadastro-completo', corpo, undefined, chave);
      const mensagem = id ? 'Cadastro atualizado.' : resultado.repetido
        ? `Academia #${resultado.id} já cadastrada. Gere outro link na gestão de convites se precisar.`
        : `Academia #${resultado.id} cadastrada.`;
      if (resultado?.link) setLink(resultado.link);
      confirmar(mensagem, Boolean(resultado?.link));
    } catch (falha) {
      if (falha.status === 401) sessaoEncerrada();
      else if (falha.status === 428) setTotp(true);
      else {
        if ([400,409].includes(falha.status)) tentativa.current = null;
        setErro(falha.message);
      }
    } finally {
      envio.current = false;
      setOcupado(false);
    }
  }

  const travado = ocupado || Boolean(tentativa.current);
  return <dialog ref={dialogo} className="sa-dialogo" aria-labelledby="sa-nova-academia"
    onCancel={(e) => { e.preventDefault(); if (!envio.current) fechar(); }}>
    <h2 id="sa-nova-academia">{titulo}</h2>
    {erro && <p className="relatorio-aviso-box" role="alert">{erro}</p>}
    {link ? <div className="campo">
      <label htmlFor="sa-convite-academia">Link do convite</label>
      <input id="sa-convite-academia" readOnly value={link} />
      <p>Entregue o link somente ao responsável autorizado.</p>
      {copiado && <p role="status">Link copiado.</p>}
      <button type="button" className="relatorios-btn" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopiado(true); }
        catch { setErro('Selecione e copie o link manualmente.'); }
      }}>Copiar link</button>
    </div> : acao === 'dados' && carregado ? <dl>
      {Object.entries(rotulos).map(([campo, rotulo]) => <div key={campo}>
        <dt>{rotulo}</dt><dd>{carregado[campo] || '—'}</dd>
      </div>)}
      <div><dt>E-mail verificado</dt><dd>{carregado.email_responsavel_verificado_em ? 'Sim' : 'Não'}</dd></div>
      <div><dt>Mensalidade contratada</dt><dd>{moedaComercial(carregado.mensalidade_centavos)}</dd></div>
    </dl> : (carregado || totp) && <form onSubmit={enviar} className="campo">
      {carregado && <fieldset disabled={travado} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <h3>{['Dados da academia', 'Endereço', 'Responsável'][etapa]}</h3>
        <CamposCadastroAcademia dados={dados} setDados={setDados} etapa={etapa} avisoCep={avisoCep} />
        {etapa === 2 && (id ? <label><input type="checkbox" required /> Confirmo a edição dos dados cadastrais</label> : <>
          <label className="campo">Condição comercial
            <select value={condicao.tipo} onChange={(e) => setCondicao({ ...condicao, tipo: e.target.value })}>
              <option value="teste">30 dias grátis, depois {moedaComercial(carregado.mensalidade_centavos)} por mês</option>
              <option value="mensal">Mensalidade de {moedaComercial(carregado.mensalidade_centavos)}</option>
              <option value="cortesia">Cortesia</option>
            </select>
          </label>
          {condicao.tipo === 'cortesia' && <>
            <label><input type="checkbox" checked={permanente} onChange={(e) => setPermanente(e.target.checked)} /> Cortesia permanente</label>
            {!permanente && <label className="campo">Cortesia até
              <input type="date" required value={condicao.ate || ''} onChange={(e) => setCondicao({ ...condicao, ate: e.target.value })} />
            </label>}
            <label className="campo">Motivo da cortesia
              <input required maxLength={240} value={condicao.motivo || ''} onChange={(e) => setCondicao({ ...condicao, motivo: e.target.value })} />
            </label>
          </>}
          <label><input type="checkbox" checked={condicao.convite}
            onChange={(e) => setCondicao({ ...condicao, convite: e.target.checked, ativar: e.target.checked && condicao.ativar })} /> Gerar convite para o responsável</label>
          {condicao.convite && <label><input type="checkbox" checked={condicao.ativar}
            onChange={(e) => setCondicao({ ...condicao, ativar: e.target.checked })} /> Ativar a academia após o aceite do convite</label>}
        </>)}
      </fieldset>}
      {totp && <label className="campo">Código do autenticador
        <input required pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" inputMode="numeric"
          value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </label>}
      <div className="sa-acoes-dialogo">
        {etapa > 0 && !totp && <button type="button" className="relatorios-btn" disabled={travado} onClick={() => setEtapa(etapa - 1)}>Voltar</button>}
        <button type="submit" className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>
          {ocupado ? 'Aguarde…' : totp ? 'Confirmar TOTP e continuar' : etapa < 2 ? 'Continuar' : 'Salvar academia'}
        </button>
      </div>
    </form>}
    {!carregado && !totp && !erro && <p role="status">Carregando…</p>}
    <button type="button" className="relatorios-btn relatorios-btn-secundario" disabled={ocupado} onClick={fechar}>Fechar</button>
  </dialog>;
}

NovaAcademia.propTypes = {
  selecao: PropTypes.shape({
    academia: PropTypes.shape({ id: PropTypes.number.isRequired }),
    acao: PropTypes.oneOf(['criar', 'dados', 'editar']),
  }),
  fechar: PropTypes.func.isRequired,
  confirmar: PropTypes.func.isRequired,
  sessaoEncerrada: PropTypes.func.isRequired,
};
