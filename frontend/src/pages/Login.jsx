
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPublica } from '../api';
import '../styles/login.css';

const academiaIndisponivel = 'O acesso à sua academia está indisponível. Entre em contato com a administração.';

export default function Login() {
  const [parametros] = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState(() => parametros.get('motivo') === 'academia-inativa' ? academiaIndisponivel : '');
  const [carregando, setCarregando] = useState(false);
  const [ofertaCadastro, setOfertaCadastro] = useState(null);
  const [documentos, setDocumentos] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const consulta = new AbortController();
    apiPublica.get('/cadastro-publico', { signal: consulta.signal })
      .then(({ data }) => { if (!consulta.signal.aborted) setOfertaCadastro(data); })
      .catch(() => {});
    apiPublica.get('/documentos-legais', { signal: consulta.signal })
      .then(({ data }) => { if (!consulta.signal.aborted) setDocumentos(data); }).catch(() => {});
    return () => consulta.abort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await login(email, senha);
      navigate('/dashboard');
    } catch (falha) {
      setErro(falha.response?.data?.codigo === 'ACADEMIA_INATIVA'
        ? academiaIndisponivel
        : 'Credenciais inválidas. Verifique os dados e tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  // Será conectado ao Google OAuth posteriormente.
  const handleGoogleLogin = () => {
    setErro('A autenticação com Google ainda precisa ser configurada.');
  };

  return (
    <main className="login-page">

      {/* PAINEL ESQUERDO - IDENTIDADE WC FIT */}
      <section className="login-brand">

        <div className="brand-content">

          {/* LOGO */}
          <div className="brand-logo">
            <div className="brand-icon">
              <svg
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 23V41M17 17V47M23 27H41M47 17V47M55 23V41"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M25 45L39 19"
                  stroke="#12B8F5"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h1>
              Wc <span>Fit</span>
            </h1>
          </div>

          <p className="brand-subtitle">
            GESTÃO INTELIGENTE PARA ACADEMIAS
          </p>

          {/* TEXTO PRINCIPAL */}
          <div className="brand-message">
            <h2>
              Sua academia
              <br />
              mais inteligente.
              <br />
              <span>Seus resultados</span>
              <br />
              <span>mais próximos.</span>
            </h2>

            <div className="brand-underline"></div>
          </div>

          {/* DIFERENCIAIS */}
          <div className="brand-features">

            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 19V10M9 19V5M15 19V12M21 19V3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 19H22"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div>
                <h3>Controle completo</h3>
                <p>Alunos, treinos e finanças</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
                  <path
                    d="M3 20V18C3 15.8 4.8 14 7 14H11C13.2 14 15 15.8 15 18V20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 5.5C17.7 6 18.5 7.8 17.8 9.3M18 14C20 14.5 21 16 21 18V20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div>
                <h3>Gestão simplificada</h3>
                <p>Tudo em um só lugar</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 21H16M12 17V21M5 4H19V9C19 13 16 16 12 16C8 16 5 13 5 9V4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 7H2V9C2 11 3 12 6 12M19 7H22V9C22 11 21 12 18 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div>
                <h3>Mais resultados</h3>
                <p>Uma academia ainda melhor</p>
              </div>
            </div>

          </div>
        </div>

        <footer className="brand-footer">
          <strong>Wc Fit</strong>
          <span>•</span>
          <p>Tecnologia que impulsiona sua academia</p>
        </footer>

      </section>

      {/* PAINEL DIREITO - LOGIN */}
      <section className="login-area">

        <div className="login-card">

          {/* CABEÇALHO */}
          <header className="login-header">

            <div className="login-logo">
              <div className="login-logo-icon">
                <svg viewBox="0 0 64 64" fill="none">
                  <path
                    d="M9 23V41M17 17V47M23 27H41M47 17V47M55 23V41"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M25 45L39 19"
                    stroke="#12B8F5"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h2>Wc <span>Fit</span></h2>
            </div>

            <p className="login-subtitle">
              GESTÃO INTELIGENTE PARA ACADEMIAS
            </p>

            <h3>Bem-vindo de volta!</h3>

            <p className="welcome-description">
              Entre na sua conta para continuar.
            </p>

          </header>

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="login-form">

            <div className="campo">
              <label htmlFor="email">
                Email ou Matrícula
              </label>

              <input
                id="email"
                type="text"
                placeholder="Digite seu email ou matrícula"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="campo">
              <label htmlFor="senha">
                Senha
              </label>

              <div className="senha-input-group">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="toggle-senha"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  aria-label={
                    mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'
                  }
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="forgot-password">
              <Link to="/esqueci-senha">
                Esqueceu sua senha?
              </Link>
            </div>

            {erro && (
              <div className="erro" role="alert">
                {erro}
              </div>
            )}

            {/* BOTÃO PRINCIPAL */}
            <button
              type="submit"
              className="btn-entrar"
              disabled={carregando}
            >
              {carregando
                ? 'Entrando...'
                : 'Entrar na plataforma'}
            </button>

            {/* LOGIN COM GOOGLE ABAIXO DO LOGIN TRADICIONAL */}
            <div className="login-divider">
              <span></span>
              <p>OU</p>
              <span></span>
            </div>

            <button
              type="button"
              className="btn-google"
              onClick={handleGoogleLogin}
            >
              <svg
                className="google-icon"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5.1h6.5c3.8-3.5 6.1-8.6 6.1-14.8Z"
                />
                <path
                  fill="#34A853"
                  d="M24 44c5.4 0 9.9-1.8 13.2-4.7l-6.5-5.1c-1.8 1.2-4 2-6.7 2-5.2 0-9.6-3.5-11.2-8.2H6.1v5.2C9.4 39.6 16.2 44 24 44Z"
                />
                <path
                  fill="#FBBC05"
                  d="M12.8 28c-.4-1.2-.7-2.6-.7-4s.3-2.8.7-4v-5.2H6.1C4.7 17.5 4 20.6 4 24s.7 6.5 2.1 9.2l6.7-5.2Z"
                />
                <path
                  fill="#EA4335"
                  d="M24 11.8c2.9 0 5.5 1 7.5 3l5.6-5.6C33.9 6 29.4 4 24 4 16.2 4 9.4 8.4 6.1 14.8l6.7 5.2c1.6-4.7 6-8.2 11.2-8.2Z"
                />
              </svg>

              <span>Continuar com Google</span>
            </button>

          </form>

          {documentos && <nav className="login-footer" aria-label="Documentos legais">
            <a href={documentos.termos_url}>Termos de Uso</a>{' · '}
            <a href={documentos.privacidade_url}>Política de Privacidade</a>
          </nav>}

          {ofertaCadastro && <div className="login-footer">
            <p>30 dias grátis. Depois, {(ofertaCadastro.mensalidade_centavos / 100)
              .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês.</p>
            <Link to="/cadastro" className="btn-outline login-cadastro-cta">Cadastrar minha academia</Link>
          </div>}

        </div>

      </section>

    </main>
  );
}
