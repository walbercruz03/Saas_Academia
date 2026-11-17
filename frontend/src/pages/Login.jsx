import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      // 'login' no AuthContext deve lidar com a validação (email ou matrícula)
      await login(email, senha);
      navigate('/dashboard');
    } catch {
      setErro('Credenciais inválidas. Verifique os dados e tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Wc Fit</h1>
          <p className="subtitle">Gestão inteligente para academias e studios</p>
          <h2 className="welcome-msg">Bem-vindo ao Wc Fit</h2>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="campo">
            <label htmlFor="email">Email ou Matrícula</label>
            <div className="input-with-icon">
              <input
                id="email"
                type="text"
                placeholder="Email ou Matrícula"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <div className="input-with-icon senha-input-group">
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="toggle-senha"
                onClick={() => setMostrarSenha(!mostrarSenha)}
              >
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {erro && <div className="erro">{erro}</div>}

          <button type="submit" className="btn-entrar" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <Link to="/esqueci-senha">Esqueceu sua senha?</Link>
          <div className="cadastro-link">
            Novo Administrador? <Link to="/cadastro-admin">Registrar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
