import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';
import { solicitar } from '../apiSuperAdmin';

const estados = { pendente: 'Pendente', expirado: 'Expirado', revogado: 'Revogado', utilizado: 'Utilizado' };
const data = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza',
});
const chaveNova = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('');

export default function ConvitesAdministradores({ academia, sessaoEncerrada, versao }) {
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [lista, setLista] = useState(null);
  const [erroLista, setErroLista] = useState('');
  const [unidades, setUnidades] = useState([]);
  const [maisUnidades, setMaisUnidades] = useState(false);
  const paginaUnidades = useRef(0);
  const [form, setForm] = useState(null);
  const [acao, setAcao] = useState(null);
  const [precisaTotp, setPrecisaTotp] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [link, setLink] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ocupada = useRef(false);

  useEffect(() => {
    const controle = new AbortController();
    const parametros = new URLSearchParams({ pagina, ...(academia && { academia }) });
    solicitar(`convites?${parametros}`, null, controle.signal).then((resultado) => {
      if (!controle.signal.aborted) {
        setLista(resultado);
        setErroLista('');
      }
    }).catch((falha) => {
      if (controle.signal.aborted) return;
      if (falha.status === 401) sessaoEncerrada();
      else setErroLista(falha.message);
    });
    return () => controle.abort();
  }, [academia, pagina, recarga, sessaoEncerrada, versao]);

  async function carregarUnidades() {
    try {
      const dados = await solicitar(`academias?pagina=${paginaUnidades.current + 1}`);
      paginaUnidades.current = dados.pagina;
      setUnidades((anteriores) => anteriores.concat(dados.registros));
      setMaisUnidades(dados.temMais);
    } catch (falha) {
      if (falha.status === 401) sessaoEncerrada();
      else setErro(falha.message);
    }
  }

  function novo() {
    setLink('');
    setErro('');
    setMensagem('');
    setForm({ academia: '', nome: '', email: '' });
    if (!paginaUnidades.current) carregarUnidades();
  }

  function cancelar() {
    setForm(null);
    setAcao(null);
    setPrecisaTotp(false);
    setCodigo('');
    setErro('');
  }

  async function executar(operacao, reconfirmar = false) {
    if (ocupada.current) return;
    ocupada.current = true;
    setEnviando(true);
    setErro('');
    setMensagem('');
    setLink('');
    setAcao(operacao);
    try {
      if (reconfirmar) {
        await solicitar('auth/totp-recente', { codigo });
        setPrecisaTotp(false);
        setCodigo('');
      }
      if (operacao.tipo === 'emitir') {
        const resultado = await solicitar(`academias/${operacao.academia}/convites`,
          { nome: operacao.nome, email: operacao.email }, undefined, operacao.chave);
        setLink(resultado.link || '');
        setMensagem(resultado.link ? 'Convite gerado.' : 'Convite já registrado. Reemita se precisar de um novo link.');
        setPagina(1);
      } else if (operacao.tipo === 'revogar') {
        await solicitar(`convites/${operacao.id}/revogar`, {});
        setMensagem('Convite revogado.');
      } else {
        const { removidos } = operacao.tipo === 'limpar'
          ? await solicitar('convites/limpar', { confirmar: true, ...(academia && { academia }) })
          : await solicitar(`convites/${operacao.id}/excluir`, { confirmar: true });
        setMensagem(removidos === 1 ? '1 convite removido da lista.' : `${removidos} convites removidos da lista.`);
      }
      cancelar();
      setLista(null);
      setErroLista('');
      setRecarga((n) => n + 1);
    } catch (falha) {
      if (falha.status === 401) sessaoEncerrada();
      else if (falha.status === 428) setPrecisaTotp(true);
      else {
        setErro(falha.message);
        if ([400, 404, 409].includes(falha.status)) {
          setAcao(null);
          setPrecisaTotp(false);
          setCodigo('');
        }
      }
    } finally {
      ocupada.current = false;
      setEnviando(false);
    }
  }

  function preparar(operacao) {
    setErro('');
    setLink('');
    setForm(null);
    setAcao(operacao);
  }

  const confirmacoes = acao && {
    emitir: `Gerar convite para ${acao.email}?`,
    revogar: `Revogar convite #${acao.id}?`,
    excluir: `Excluir o convite #${acao.id} da lista?`,
    limpar: `Limpar todos os convites finalizados ${academia ? 'desta academia' : 'de todas as academias'}?`,
  };

  return (
    <section aria-labelledby="sa-convites">
      <h2 id="sa-convites">Convites de administradores</h2>
      {!form && !acao && <button type="button" className="relatorios-btn relatorios-btn-primario" onClick={novo}>Novo administrador</button>}
      {!form && !acao && lista?.finalizados > 0 && (
        <button type="button" className="relatorios-btn relatorios-btn-secundario"
          onClick={() => preparar({ tipo: 'limpar' })}>Limpar convites finalizados</button>
      )}
      {mensagem && <p role="status" className="relatorio-aviso-box">{mensagem}</p>}
      {erro && <p role="alert" className="relatorio-aviso-box">{erro}</p>}
      {link && (
        <div className="campo">
          <label htmlFor="sa-link-convite">Link do convite</label>
          <input id="sa-link-convite" readOnly value={link} />
          <p>O link é uma credencial temporária. Entregue somente ao responsável autorizado. A entrega manual não verifica a titularidade do e-mail.</p>
          <div className="sa-acoes-dialogo">
            <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={async () => {
              try { await navigator.clipboard.writeText(link); setMensagem('Link copiado.'); }
              catch { setErro('Selecione o link no campo e copie manualmente.'); }
            }}>Copiar link</button>
            <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={() => setLink('')}>Ocultar link</button>
          </div>
        </div>
      )}
      {form && !acao && (
        <form className="form-grid sa-filtros" onSubmit={(evento) => {
          evento.preventDefault();
          executar({ ...form, tipo: 'emitir', chave: chaveNova() });
        }}>
          <label className="campo">Academia
            <select required value={form.academia} onChange={(e) => setForm({ ...form, academia: e.target.value })}>
              <option value="">Selecione a academia</option>
              {unidades.map((unidade) => <option key={unidade.id} value={unidade.id}>{unidade.nome}{!unidade.ativa && ' · Inativa'}</option>)}
            </select>
            {maisUnidades && <button className="relatorios-btn relatorios-btn-secundario" type="button" onClick={carregarUnidades}>Mais academias</button>}
          </label>
          <label className="campo">Nome completo
            <input required maxLength={160} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">E-mail
            <input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <div className="sa-acoes-dialogo">
            <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={cancelar}>Cancelar</button>
            <button type="submit" className="relatorios-btn relatorios-btn-primario">Gerar convite</button>
          </div>
        </form>
      )}
      {acao && (
        <form className="sa-filtros" onSubmit={(evento) => { evento.preventDefault(); executar(acao, precisaTotp); }}>
          <p>{confirmacoes[acao.tipo]}</p>
          {['excluir', 'limpar'].includes(acao.tipo) && <p>Os convites serão ocultados definitivamente da lista. O histórico e o controle de reenvios serão preservados.</p>}
          {precisaTotp && (
            <label className="campo">Código do autenticador
              <input required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code"
                value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
          )}
          <div className="sa-acoes-dialogo">
            <button type="button" disabled={enviando} className="relatorios-btn relatorios-btn-secundario" onClick={cancelar}>Cancelar</button>
            <button type="submit" disabled={enviando} className="relatorios-btn relatorios-btn-primario">
              {enviando ? 'Aguarde…' : precisaTotp ? 'Confirmar e continuar' : 'Confirmar operação'}
            </button>
          </div>
        </form>
      )}
      {erroLista && <p role="alert">{erroLista} <button type="button" onClick={() => {
        setErroLista(''); setLista(null); setRecarga((n) => n + 1);
      }}>Tentar novamente</button></p>}
      {!lista && !erroLista && <p role="status">Carregando convites…</p>}
      {lista && <p>Total de convites: {lista.total} · Finalizados: {lista.finalizados}</p>}
      {lista && (lista.registros.length ? (
        <div className="relatorio-tabela-wrapper sa-tabela" tabIndex={0} aria-label="Tabela de convites" role="region">
          <table className="relatorio-tabela">
            <thead><tr>{['Responsável', 'E-mail', 'Academia', 'Situação', 'Expiração', 'Ações'].map((coluna) => <th key={coluna} scope="col">{coluna}</th>)}</tr></thead>
            <tbody>{lista.registros.map((item) => (
              <tr key={item.id}>
                <th scope="row">{item.nome}</th><td>{item.email}</td><td>{item.academia_nome}</td>
                <td>{estados[item.situacao]}</td><td>{data.format(new Date(item.expira_em))}</td>
                <td>
                  {item.situacao === 'pendente' && <button type="button" disabled={enviando || !!acao} onClick={() => {
                    setErro(''); setLink(''); setForm(null); setAcao({ tipo: 'revogar', id: item.id });
                  }}>Revogar</button>}
                  {item.situacao !== 'pendente' && <button type="button" disabled={enviando || !!acao}
                    onClick={() => preparar({ tipo: 'excluir', id: item.id })}>Excluir</button>}
                  {item.situacao !== 'utilizado' && <button type="button" disabled={enviando || !!acao} onClick={() => {
                    setErro(''); setLink(''); setForm(null);
                    setAcao({ tipo: 'emitir', academia: item.academia_id, nome: item.nome, email: item.email, chave: chaveNova() });
                  }}>Reemitir</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="relatorio-vazio">Nenhum convite encontrado.</p>)}
      {lista && (lista.pagina > 1 || lista.temMais) && (
        <nav className="sa-paginacao" aria-label="Paginação de convites">
          <button type="button" disabled={lista.pagina === 1} onClick={() => { setLista(null); setPagina(lista.pagina - 1); }}>Anterior</button>
          <span>Página {lista.pagina}</span>
          <button type="button" disabled={!lista.temMais} onClick={() => { setLista(null); setPagina(lista.pagina + 1); }}>Próxima</button>
        </nav>
      )}
    </section>
  );
}

ConvitesAdministradores.propTypes = {
  academia: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sessaoEncerrada: PropTypes.func.isRequired,
  versao: PropTypes.number.isRequired,
};
