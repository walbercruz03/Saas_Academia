import { MINIMO_SENHA, MENSAGEM_SENHA, senhaValida } from '../politicaSenha';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/login.css';

export default function AceitarConvite() {
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ocupada = useRef(false);
  const valido = /^[A-Za-z0-9_-]{43}$/.test(token);

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname);
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  async function enviar(evento) {
    evento.preventDefault();
    if (ocupada.current || !valido) return;
    setErro('');
    if (senha !== confirmacao || !senhaValida(senha)) {
      setErro(senha !== confirmacao ? 'As senhas precisam coincidir.' : MENSAGEM_SENHA);
      return;
    }
    ocupada.current = true;
    setEnviando(true);
    try {
      const resposta = await fetch('/api/convites/aceitar', {
        method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.mensagem);
      setSenha('');
      setConfirmacao('');
      setToken('');
      setSucesso(dados.mensagem);
    } catch (falha) {
      setErro(falha.message || 'Não foi possível confirmar o convite.');
    } finally {
      ocupada.current = false;
      setEnviando(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-content"><div className="brand-logo"><h1>Wc <span>Fit</span></h1></div></div>
      </section>
      <section className="login-area">
        <div className="login-card">
          <header className="login-header"><h2>Definir senha do administrador</h2></header>
          {sucesso ? <p role="status">{sucesso}</p> : !valido ? <p role="alert">Convite indisponível.</p> : (
            <form className="login-form" onSubmit={enviar}>
              <label className="campo">Nova senha
                <input type="password" autoComplete="new-password" required minLength={MINIMO_SENHA}
                  value={senha} onChange={(e) => setSenha(e.target.value)} />
              </label>
              <label className="campo">Confirme a senha
                <input type="password" autoComplete="new-password" required minLength={MINIMO_SENHA}
                  value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
              </label>
              {erro && <p className="erro" role="alert">{erro}</p>}
              <button type="submit" className="btn-entrar" disabled={enviando}>
                {enviando ? 'Aguarde…' : 'Definir senha'}
              </button>
            </form>
          )}
          <div className="login-footer"><Link to="/login">Ir para o login</Link></div>
        </div>
      </section>
    </main>
  );
}
