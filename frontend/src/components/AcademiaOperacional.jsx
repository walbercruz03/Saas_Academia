import { useEffect, useRef, useState } from 'react';
import { solicitar } from '../apiSuperAdmin';

export const situacoesAcademia = {
  ativa: 'Ativa',
  excluida: 'Excluída',
  aguardando_ativacao: 'Aguardando primeira ativação',
  suspensa: 'Suspensa',
  inativa_indeterminada: 'Inativa de origem indeterminada',
};

export const acoesAcademia = {
  ativa: ['suspender', 'Suspender'],
  aguardando_ativacao: ['ativar', 'Ativar'],
  suspensa: ['reativar', 'Reativar'],
  inativa_indeterminada: ['regularizar', 'Regularizar'],
};

const nomes = { excluir: 'Excluir academia', 'excluir-definitivamente': 'Excluir definitivamente',
  academia_editada: 'Cadastro editado', academia_excluida: 'Academia excluída', ativar: 'Ativação', suspender: 'Suspensão', reativar: 'Reativação', regularizar: 'Regularização' };
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Fortaleza',
});

function criarChave() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function AcademiaOperacional({ selecao, fechar, atualizar, sessaoEncerrada }) {
  const { academia, acao } = selecao;
  const historico = acao === 'historico';
  const exclusao = ['excluir', 'excluir-definitivamente'].includes(acao);
  const exigeMotivo = !exclusao && acao !== 'ativar';
  const dialogo = useRef(null);
  const emEnvio = useRef(false);
  const operacao = useRef(null);
  const [motivo, setMotivo] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [totp, setTotp] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [registros, setRegistros] = useState(null);

  useEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    return () => elemento.close();
  }, []);

  useEffect(() => {
    if (!historico) return undefined;
    const controle = new AbortController();
    solicitar(`academias/${academia.id}/historico-operacional?pagina=${pagina}`, null, controle.signal)
      .then((resultado) => {
        if (!controle.signal.aborted) setRegistros(resultado);
      }).catch((falha) => {
        if (controle.signal.aborted) return;
        if (falha.status === 401) sessaoEncerrada();
        else setErro(falha.message);
      });
    return () => controle.abort();
  }, [historico, academia.id, pagina, sessaoEncerrada]);

  async function enviar(evento) {
    evento.preventDefault();
    if (emEnvio.current) return;
    if (!confirmado || (exigeMotivo && !motivo.trim())) {
      setErro('Confirme a operação e informe o motivo quando obrigatório.');
      return;
    }
    emEnvio.current = true;
    setEnviando(true);
    setErro('');
    try {
      if (!operacao.current) operacao.current = { chave: criarChave(), dados: { motivo: motivo.trim(), confirmado: true } };
      if (totp) {
        await solicitar('auth/totp-recente', { codigo });
        setTotp(false);
        setCodigo('');
      }
      const { chave, dados } = operacao.current;
      const resultado = await solicitar(`academias/${academia.id}/${acao}`, exclusao ? { confirmar: true } : dados, undefined, chave);
      atualizar(resultado?.repetido ? 'Operação já registrada. A situação atual foi atualizada.'
        : `Operação concluída para a academia #${academia.id}.`);
    } catch (falha) {
      if (falha.status === 401) sessaoEncerrada();
      else if (falha.status === 428) setTotp(true);
      else {
        setErro(falha.message || 'Não foi possível confirmar a operação. Tente novamente.');
        if (!totp && [400, 409].includes(falha.status)) operacao.current = null;
      }
    } finally {
      emEnvio.current = false;
      setEnviando(false);
    }
  }

  return (
    <dialog ref={dialogo} className="sa-dialogo" aria-labelledby="sa-operacao-titulo"
      onCancel={(evento) => { evento.preventDefault(); if (!emEnvio.current) fechar(); }}>
      <h2 id="sa-operacao-titulo">{historico ? 'Histórico operacional' : nomes[acao]}</h2>
      <p>{academia.nome} (#{academia.id})</p>
      {erro && <p role="alert" className="relatorio-aviso-box">{erro}</p>}
      {historico ? (
        <>
          {!registros && !erro && <p role="status">Carregando histórico…</p>}
          {registros?.registros.length === 0 && <p>Nenhuma alteração operacional registrada nesta página.</p>}
          {registros?.registros.map((linha) => (
            <article className="stat-card" key={`${linha.origem}:${linha.id}`}>
              <strong>{nomes[linha.operacao]}</strong>
              {linha.estado_anterior && <span>{situacoesAcademia[linha.estado_anterior]} → {situacoesAcademia[linha.estado_novo]}</span>}
              {linha.motivo && <p>{linha.motivo}</p>}
              <span>{dataHora.format(new Date(linha.criado_em))} · Super Admin #{linha.proprietario_id}</span>
            </article>
          ))}
          {registros && (pagina > 1 || registros.temMais) && (
            <nav className="sa-paginacao" aria-label="Paginação do histórico">
              <button type="button" disabled={pagina === 1} onClick={() => { setRegistros(null); setPagina(pagina - 1); }}>Anterior</button>
              <span>Página {pagina}</span>
              <button type="button" disabled={!registros.temMais} onClick={() => { setRegistros(null); setPagina(pagina + 1); }}>Próxima</button>
            </nav>
          )}
          <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={fechar}>Fechar</button>
        </>
      ) : (
        <form className="campo" onSubmit={enviar}>
          {acao === 'suspender' && <p>Novos acessos à academia serão bloqueados. Os usuários precisarão entrar novamente após a reativação.</p>}
          {exclusao ? <p>{acao === 'excluir-definitivamente'
            ? 'Esta exclusão é irreversível e só será realizada se a academia estiver sem vínculos impeditivos.'
            : 'O acesso será bloqueado, as sessões e convites pendentes serão revogados e a academia ficará na lista de excluídas.'}</p> : <>
            <label htmlFor="sa-motivo">{exigeMotivo ? 'Motivo (obrigatório)' : 'Motivo (opcional)'}</label>
            <input id="sa-motivo" maxLength={500} value={motivo} required={exigeMotivo}
              readOnly={enviando || !!operacao.current} onChange={(evento) => setMotivo(evento.target.value)} />
          </>}
          <label>
            <input type="checkbox" required checked={confirmado} disabled={enviando || !!operacao.current}
              onChange={(e) => setConfirmado(e.target.checked)} /> {exclusao ? `Confirmo: ${nomes[acao].toLowerCase()}` : 'Confirmo esta alteração operacional'}
          </label>
          {totp && (
            <label className="campo">Novo código do autenticador
              <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
                value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            </label>
          )}
          <div className="sa-acoes-dialogo">
            <button type="button" disabled={enviando} className="relatorios-btn relatorios-btn-secundario" onClick={fechar}>Cancelar</button>
            <button type="submit" disabled={enviando} className="relatorios-btn relatorios-btn-primario">
              {enviando ? 'Aguarde…' : totp ? 'Confirmar TOTP e continuar' : 'Confirmar alteração'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
