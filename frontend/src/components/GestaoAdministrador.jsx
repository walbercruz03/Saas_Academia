import PropTypes from 'prop-types';
import { rotulosGestao } from '../rotulosGestao';
import { useEffect, useRef, useState } from 'react';
import { solicitar } from '../apiSuperAdmin';

const dataHora = new Intl.DateTimeFormat('pt-BR',{ dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza' });

export default function GestaoAdministrador({ id, nome, fechar, atualizar, sessaoEncerrada }) {
  const [dados,setDados]=useState(null);
  const [pagina,setPagina]=useState(1);
  const [versao,setVersao]=useState(0);
  const [erro,setErro]=useState('');
  const [mensagem,setMensagem]=useState('');
  const [pendente,setPendente]=useState(null);
  const [codigo,setCodigo]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const ocupadoRef=useRef(false);

  useEffect(()=>{
    const controle=new AbortController();
    solicitar(`administradores/${id}/gestao?pagina=${pagina}`,null,controle.signal)
      .then(dados=>{if(!controle.signal.aborted)setDados(dados)})
      .catch(e=>{
        if(controle.signal.aborted)return;
        if(e.status===401)sessaoEncerrada();
        else setErro(e.message);
      });
    return ()=>controle.abort();
  },[id,pagina,versao,sessaoEncerrada]);

  const executar=async(acao,corpo={},reconfirmar=false)=>{
    if(ocupadoRef.current)return;
    ocupadoRef.current=true;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try{
      if(reconfirmar)await solicitar('auth/totp-recente',{codigo});
      await solicitar(`administradores/${id}/${acao}`,{...corpo,confirmar:true});
      if (acao === 'excluir-definitivamente') {
        atualizar();
        fechar();
        return;
      }
      setPendente(null);
      setCodigo('');
      setMensagem(['email','senha'].includes(acao)?'E-mail de confirmação enviado.':'Operação concluída.');
      setVersao(v=>v+1);
      atualizar();
    }catch(e){
      if(e.status===428)setPendente({acao,corpo});
      else if(e.status===401)sessaoEncerrada();
      else {
        setPendente(null);
        setCodigo('');
        setErro(e.message);
      }
    }finally{
      ocupadoRef.current=false;
      setOcupado(false);
    }
  };

  function confirmar(acao,texto,corpo={}) {
    if (!ocupadoRef.current && window.confirm(texto)) executar(acao,corpo);
  }

  const conta=dados?.conta;
  return <section className="form-card" aria-label="Gerenciamento do administrador">
    <h3>{conta?.nome || nome} · #{id}</h3>
    <button type="button" className="relatorios-btn relatorios-btn-secundario" onClick={fechar} disabled={ocupado}>Fechar</button>
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    {pendente && <form className="relatorios-controles sa-filtros" onSubmit={e=>{
      e.preventDefault(); executar(pendente.acao,pendente.corpo,true);
    }}>
      <label>Código do autenticador <input className="relatorios-select" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{6}" maxLength={6} required value={codigo} onChange={e=>setCodigo(e.target.value)} /></label>
      <button className="relatorios-btn relatorios-btn-primario" disabled={ocupado}>Reconfirmar e executar</button>
      <button type="button" className="relatorios-btn" disabled={ocupado} onClick={()=>{setPendente(null);setCodigo('')}}>Cancelar</button>
    </form>}
    {conta && <>
      {!conta.excluido && <>
        <form key={JSON.stringify([conta.nome,conta.telefone])} className="relatorios-controles sa-filtros" onSubmit={e=>{
          e.preventDefault(); confirmar('editar','Salvar nome e telefone deste administrador?',Object.fromEntries(new FormData(e.currentTarget)));
        }}>
          <label>Nome <input className="relatorios-select" name="nome" defaultValue={conta.nome} required maxLength={160} /></label>
          <label>Telefone <input className="relatorios-select" type="tel" name="telefone" defaultValue={conta.telefone || ''} maxLength={32} /></label>
          <button className="relatorios-btn relatorios-btn-primario" disabled={ocupado||Boolean(pendente)}>Salvar dados</button>
        </form>
        {conta.status==='ativo' && <>
          <form key={`email-${versao}`} className="relatorios-controles sa-filtros" onSubmit={e=>{
            e.preventDefault(); confirmar('email','Enviar a confirmação para o novo e-mail?',Object.fromEntries(new FormData(e.currentTarget)));
          }}>
            <label>Novo e-mail <input className="relatorios-select" type="email" name="email" required maxLength={254} /></label>
            <button className="relatorios-btn" disabled={ocupado||Boolean(pendente)}>Solicitar alteração</button>
          </form>
          <button type="button" className="relatorios-btn" disabled={ocupado||Boolean(pendente)}
            onClick={()=>confirmar('senha','Enviar um link de redefinição ao e-mail cadastrado?')}>Solicitar redefinição de senha</button>
        </>}
        <button type="button" className="relatorios-btn" disabled={ocupado||Boolean(pendente)}
          onClick={()=>conta.status==='ativo'?confirmar('desativar','Desativar a conta e revogar todas as suas sessões?'):
            confirmar('reativar','Reativar este administrador?')}>{conta.status==='ativo'?'Desativar':'Reativar'}</button>
        <button type="button" className="relatorios-btn" disabled={ocupado||Boolean(pendente)}
          onClick={()=>confirmar('excluir','Excluir logicamente o administrador e encerrar todas as suas sessões?')}>Excluir conta</button>
      </>}
      {conta.excluido && <>
        <p>Conta excluída e oculta da listagem principal.</p>
        <button type="button" className="relatorios-btn" disabled={ocupado || Boolean(pendente)}
          onClick={() => confirmar('excluir-definitivamente',
            `Excluir definitivamente a conta #${id}? Esta ação é irreversível e preserva a auditoria.`)}>
          Excluir definitivamente
        </button>
      </>}
      <h4>Sessões</h4>
      {dados.sessoes.length ? <ul>{dados.sessoes.map(s=><li key={s.id}>
        #{s.id} · {dataHora.format(new Date(s.criada_em))} · {s.ativa?'Ativa':s.revogada_em?'Revogada':'Expirada'}{' '}
        {s.ativa&&!conta.excluido&&<button type="button" className="relatorios-btn" disabled={ocupado||Boolean(pendente)}
          onClick={()=>confirmar('revogar','Revogar somente esta sessão?',{sessao:s.id})}>Revogar sessão</button>}
      </li>)}</ul>:<p>Nenhuma sessão nesta página.</p>}
      <h4>Histórico administrativo</h4>
      {dados.historico.length ? <ul>{dados.historico.map(h=><li key={h.id}>
        {dataHora.format(new Date(h.criado_em))} · {rotulosGestao[h.acao]||h.acao}
      </li>)}</ul>:<p>Nenhuma alteração nesta página.</p>}
      {(pagina>1||dados.temMais) && <div className="btn-grupo">
        <button type="button" className="relatorios-btn" disabled={pagina<=1} onClick={()=>setPagina(v=>v-1)}>Anterior</button>
        <button type="button" className="relatorios-btn" disabled={!dados.temMais} onClick={()=>setPagina(v=>v+1)}>Próxima</button>
      </div>}
    </>}
  </section>;
}

GestaoAdministrador.propTypes = {
  id: PropTypes.number.isRequired,
  nome: PropTypes.string.isRequired,
  fechar: PropTypes.func.isRequired,
  atualizar: PropTypes.func.isRequired,
  sessaoEncerrada: PropTypes.func.isRequired,
};
