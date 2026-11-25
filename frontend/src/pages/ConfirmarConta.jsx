import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { MINIMO_SENHA, MENSAGEM_SENHA, senhaValida } from '../politicaSenha';
import '../styles/login.css';

export default function ConfirmarConta() {
  const [params] = useSearchParams();
  const tipo = params.get('tipo');
  const [codigo] = useState(() => window.location.hash.slice(1));
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [concluido, setConcluido] = useState(false);
  const valido = /^[A-Za-z0-9_-]{43}$/.test(codigo) && ['email','senha'].includes(tipo);
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);

  async function confirmar(evento) {
    evento.preventDefault();
    if (ocupado || !valido) return;
    if (tipo === 'senha' && (!senhaValida(senha) || senha !== confirmacao)) {
      setErro(senha !== confirmacao ? 'As senhas precisam coincidir.' : MENSAGEM_SENHA);
      return;
    }
    setOcupado(true);
    setErro('');
    try {
      await api.post('/auth/confirmar-conta', { codigo,tipo,...(tipo==='senha' && {senha}) });
      setConcluido(true);
      setSenha('');
      setConfirmacao('');
    } catch (falha) {
      setErro(falha.response?.data?.mensagem || 'Não foi possível confirmar a operação.');
    } finally {
      setOcupado(false);
    }
  }
  return <div className="login-page"><div className="login-card">
    <div className="login-header"><h1>{tipo === 'senha' ? 'Redefinir senha' : 'Confirmar e-mail'}</h1></div>
    {concluido ? <p role="status">Conta atualizada. Entre novamente.</p> : valido ? (
      <form className="login-form" onSubmit={confirmar}>
        {tipo === 'senha' && <>
          <label>Nova senha <input autoComplete="new-password" type="password" required minLength={MINIMO_SENHA}
            value={senha} onChange={e => setSenha(e.target.value)} /></label>
          <label>Confirme a senha <input autoComplete="new-password" type="password" required minLength={MINIMO_SENHA}
            value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></label>
        </>}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn-entrar" disabled={ocupado}>Confirmar</button>
      </form>
    ) : <p role="alert">Link inválido ou expirado.</p>}
    <Link to="/login">Ir para o login</Link>
  </div></div>;
}
