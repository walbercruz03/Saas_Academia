import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Anexa automaticamente o token JWT em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('wcfit_token') ||
      localStorage.getItem('authToken');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Trata respostas não autorizadas (401) e acesso negado (403)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const academiaInativa = status === 403 && error.response?.data?.codigo === 'ACADEMIA_INATIVA';
    if (status === 403 && error.response?.data?.codigo === 'PERMISSAO_NEGADA') {
      window.dispatchEvent(new Event('wcfit:permissao-negada'));
    }
    if (status === 401 || academiaInativa) {
      localStorage.removeItem('token');
      localStorage.removeItem('wcfit_token');
      localStorage.removeItem('authToken');
      localStorage.removeItem('usuario');
      if (window.location.pathname !== '/login') {
        window.location.href = academiaInativa ? '/login?motivo=academia-inativa' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;