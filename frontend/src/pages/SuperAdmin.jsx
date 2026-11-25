import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/login.css';

import { solicitar } from '../apiSuperAdmin';

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [etapa, setEtapa] = useState('verificando');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [segredo, setSegredo] = useState('');
  const [codigos, setCodigos] = useState([]);
  const [erro, setErro] = useState(state?.mensagem || '');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    solicitar('auth/sessao', null, controller.signal).then(() => {
      if (controller.signal.aborted) return;
      navigate('/super-admin', { replace: true });
    }).catch((falha) => {
      if (controller.signal.aborted) return;
      setEtapa('login');
      if (falha.status !== 401) setErro(falha.message);
    });
    return () => controller.abort();
  }, [navigate]);

  async function avancar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      if (etapa === 'login' || etapa === 'recuperar') {
        const resposta = await solicitar(etapa === 'login' ? 'auth/login' : 'auth/recuperar', { email, senha, codigo });
        setSenha('');
        setCodigo('');
        if (resposta.etapa === 'autenticada') {
          navigate('/super-admin', { replace: true });
          return;
        }
        setEtapa(resposta.etapa);
        if (resposta.etapa === 'configurar') {
          const configuracao = await solicitar('auth/configurar', {});
          setSegredo(configuracao.segredo);
        }
        return;
      }
      if (etapa === 'configurar' && !segredo) {
        const configuracao = await solicitar('auth/configurar', {});
        setSegredo(configuracao.segredo);
        return;
      }
      const resposta = await solicitar('auth/validar', { codigo });
      setCodigo('');
      setSegredo('');
      if (resposta.codigos?.length) {
        setCodigos(resposta.codigos);
        setEtapa('codigos');
      } else {
        navigate('/super-admin', { replace: true });
      }
    } catch (falha) {
      setErro(falha.message);
      if (falha.status === 401 && (etapa === 'configurar' || etapa === 'validar')) {
        setSegredo('');
        setCodigo('');
        setEtapa('login');
      }
    } finally {
      setOcupado(false);
    }
  }

  const credenciais = etapa === 'login' || etapa === 'recuperar';
  const pedirCodigo = etapa === 'validar' || etapa === 'recuperar' || (etapa === 'configurar' && segredo);

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-content">
          <div className="brand-logo"><h1>Wc <span>Fit</span></h1></div>
          <p className="brand-subtitle">Administração da plataforma</p>
        </div>
      </section>
      <section className="login-area">
        <div className="login-card">
          <header className="login-header"><h2>Super Admin</h2></header>
          {erro && <div className="erro" role="alert">{erro}</div>}
          {etapa === 'verificando' && <p>Verificando sessão…</p>}
          {etapa === 'codigos' && (
            <div className="login-form">
              <p>Guarde estes códigos em local seguro. Cada código só pode ser usado uma vez e será exibido apenas agora.</p>
              <ul>{codigos.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
              <button type="button" className="btn-entrar" onClick={() => {
                setCodigos([]);
                navigate('/super-admin', { replace: true });
              }}>Ir para a administração</button>
            </div>
          )}
          {['login', 'recuperar', 'configurar', 'validar'].includes(etapa) && (
            <form className="login-form" onSubmit={avancar}>
              {credenciais && (
                <>
                  <div className="campo">
                    <label htmlFor="sa-email">E-mail</label>
                    <input id="sa-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="campo">
                    <label htmlFor="sa-senha">Senha</label>
                    <input id="sa-senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
                  </div>
                </>
              )}
              {etapa === 'configurar' && segredo && (
                <div className="campo">
                  <label htmlFor="sa-segredo">Chave do autenticador</label>
                  <input id="sa-segredo" readOnly value={segredo} />
                  <p>Adicione a chave ao autenticador como código baseado em tempo.</p>
                </div>
              )}
              {pedirCodigo && (
                <div className="campo">
                  <label htmlFor="sa-codigo">{etapa === 'recuperar' ? 'Código de recuperação' : 'Código do autenticador'}</label>
                  <input id="sa-codigo" autoComplete="one-time-code" inputMode={etapa === 'recuperar' ? 'text' : 'numeric'}
                    maxLength={etapa === 'recuperar' ? 32 : 6} required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
                </div>
              )}
              <button type="submit" className="btn-entrar" disabled={ocupado}>
                {ocupado ? 'Aguarde…' : etapa === 'configurar' && !segredo ? 'Obter chave' : 'Continuar'}
              </button>
              {(etapa === 'login' || etapa === 'validar') && (
                <button type="button" className="btn-google" disabled={ocupado} onClick={() => {
                  setCodigo('');
                  setErro('');
                  setEtapa('recuperar');
                }}>Usar código de recuperação</button>
              )}
              {etapa === 'recuperar' && (
                <button type="button" className="btn-google" disabled={ocupado} onClick={() => {
                  setCodigo('');
                  setErro('');
                  setEtapa('login');
                }}>Voltar ao login</button>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
