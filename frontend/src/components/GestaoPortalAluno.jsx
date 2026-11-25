import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { KeyRound, Save, Shield, UserRound } from 'lucide-react';
import api from '../api';

export default function GestaoPortalAluno({ id, administrador }) {
  const [estado, setEstado] = useState(null);
  const [professor, setProfessor] = useState('');
  const [meta,setMeta] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [codigo, setCodigo] = useState(null);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const rota = `/alunos/${id}/portal`;

  useEffect(() => {
    const controle = new AbortController();
    api.get(rota,{ signal:controle.signal }).then(({ data }) => {
      if (controle.signal.aborted) return;
      setEstado(data);
      setProfessor(data.professor_id ?? '');
      setObjetivo(data.objetivo || '');
      setMeta(data.meta_semanal ?? '');
    }).catch((falha) => {
      if (!controle.signal.aborted) setErro(falha.response?.data?.mensagem || 'O portal está indisponível para este aluno.');
    });
    return () => controle.abort();
  }, [rota]);

  async function orientar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setMensagem('');
    setErro('');
    try {
      await api.put(rota + '/orientacao', { objetivo, ...(administrador && { professor_id:professor === '' ? null : Number(professor) }) });
      setMensagem('Orientação salva.');
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível salvar a orientação.');
    } finally {
      setOcupado(false);
    }
  }

  async function salvarMeta(evento) {
    evento.preventDefault();
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      await api.put(rota + '/meta-semanal',{ meta_semanal:meta === '' ? null : Number(meta) });
      setMensagem(meta === '' ? 'Meta semanal removida.' : 'Meta semanal salva.');
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível salvar a meta.');
    } finally {
      setOcupado(false);
    }
  }

  async function alterar(acao) {
    const confirmacao = acao === 'bloquear' ? 'Bloquear o portal e encerrar as sessões deste aluno?'
      : 'Gerar um novo código de uso único e encerrar as sessões deste aluno?';
    if (!window.confirm(confirmacao)) return;
    setOcupado(true);
    setErro('');
    setMensagem('');
    setCodigo(null);
    try {
      const { data } = await api.post(rota + '/acesso', { acao });
      setEstado((atual) => ({ ...atual, bloqueado:acao === 'bloquear', ativo:false, codigo_pendente:Boolean(data.codigo) }));
      setCodigo(data.codigo ? data : null);
      setMensagem(data.codigo ? 'Código gerado.' : 'Acesso bloqueado.');
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível alterar o acesso.');
    } finally {
      setOcupado(false);
    }
  }

  return <section className="form-card" aria-labelledby="gestao-portal-titulo">
    <h3 id="gestao-portal-titulo">Portal do Aluno</h3>
    {erro && <p className="msg-erro" role="alert">{erro}</p>}
    {mensagem && <p className="msg-sucesso" role="status">{mensagem}</p>}
    {!estado && !erro && <p role="status">Carregando o acesso…</p>}
    {estado && <>
      {administrador && <div className="treinamento-item-box">
        <h4>Acesso do aluno</h4>
        <p>{estado.bloqueado ? 'Bloqueado' : estado.ativo ? 'Ativo' : estado.codigo_pendente ? 'Aguardando uso do código' : 'Sem código válido'}</p>
        <div className="btn-grupo">
          {estado.bloqueado
            ? <button type="button" className="treinamento-btn treinamento-btn--primario" disabled={ocupado} onClick={() => alterar('liberar')}>
              <KeyRound size={16} aria-hidden="true" /> Liberar com código
            </button>
            : <>
              <button type="button" className="treinamento-btn treinamento-btn--neutro" disabled={ocupado} onClick={() => alterar('recuperar')}>
                <KeyRound size={16} aria-hidden="true" /> Gerar código de recuperação
              </button>
              <button type="button" className="treinamento-btn treinamento-btn--perigo" disabled={ocupado} onClick={() => alterar('bloquear')}>
                <Shield size={16} aria-hidden="true" /> Bloquear acesso
              </button>
            </>}
        </div>
        {codigo && <div className="campo">
          <label htmlFor="gestao-portal-codigo">Código válido por {codigo.expira_em_minutos} minutos</label>
          <input id="gestao-portal-codigo" value={codigo.codigo} readOnly onFocus={(e) => e.target.select()} />
          <p>Confirme a identidade do aluno e entregue o código por um canal privado. O aluno informa o CPF e o código em Primeiro acesso ou esqueci a senha.</p>
        </div>}
      </div>}
      <form onSubmit={orientar} className="form-grid">
        {administrador && <div className="campo">
          <label htmlFor="gestao-portal-professor">Professor responsável</label>
          <select id="gestao-portal-professor" value={professor} onChange={(e) => setProfessor(e.target.value)} disabled={ocupado}>
            <option value="">Sem professor responsável</option>
            {estado.professores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>}
        <div className="campo campo-full">
          <label htmlFor="gestao-portal-objetivo">Objetivo visível ao aluno</label>
          <textarea id="gestao-portal-objetivo" value={objetivo} maxLength={500}
            onChange={(e) => setObjetivo(e.target.value)} disabled={ocupado} />
        </div>
        <div className="btn-grupo"><button className="treinamento-btn treinamento-btn--primario" disabled={ocupado}>
          {administrador ? <UserRound size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Salvar orientação
        </button></div>
      </form>
      <form onSubmit={salvarMeta} className="form-grid">
        <div className="campo">
          <label htmlFor="gestao-portal-meta">Meta de treinos por semana</label>
          <input id="gestao-portal-meta" value={meta} type="number" min="1" max="21" step="1"
            onChange={(evento) => setMeta(evento.target.value)} disabled={ocupado} placeholder="Sem meta" />
        </div>
        <div className="btn-grupo"><button className="treinamento-btn treinamento-btn--primario" disabled={ocupado}>
          <Save size={16} aria-hidden="true" /> Salvar meta semanal
        </button></div>
      </form>
    </>}
  </section>;
}

GestaoPortalAluno.propTypes = {
  id: PropTypes.string.isRequired,
  administrador: PropTypes.bool.isRequired,
};
