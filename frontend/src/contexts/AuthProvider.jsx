import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import api from '../api';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('usuario');
        if (token) {
          try {
            const parsedUser = JSON.parse(user);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            if (mounted) setUsuario(parsedUser);
          } catch {
            // Usuário armazenado inválido: limpa e segue sem autenticar
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            delete api.defaults.headers.common['Authorization'];
          }
        }
      } catch {
        // Falha ao ler localStorage: segue sem autenticar
      } finally {
        if (mounted) setCarregando(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const professorId = usuario?.cargo === 'professor' ? usuario.id : null;
  useEffect(() => {
    if (!professorId) return;
    const controle = new AbortController();
    const atualizar = () => api.get('/auth/permissoes', { signal: controle.signal })
      .then(({ data }) => {
        if (controle.signal.aborted) return;
        setUsuario((atual) => atual?.id === professorId ? { ...atual, permissoes: data.permissoes } : atual);
      }).catch(() => {});
    atualizar();
    window.addEventListener('focus', atualizar);
    window.addEventListener('wcfit:permissao-negada', atualizar);
    const timer = window.setInterval(atualizar, 15000);
    return () => {
      controle.abort();
      window.removeEventListener('focus', atualizar);
      window.removeEventListener('wcfit:permissao-negada', atualizar);
      window.clearInterval(timer);
    };
  }, [professorId]);

  const login = async (emailOuMatricula, senha) => {
    const res = await api.post('/auth/login', {
      email_ou_matricula: emailOuMatricula,
      senha,
    });
    const { token, usuario } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUsuario(usuario);
    return usuario;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    delete api.defaults.headers.common['Authorization'];
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout, carregando }}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };
