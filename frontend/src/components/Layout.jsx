import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/styles.css';
import '../styles/layout.css';

const MENU_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'professor'] },
  { path: '/alunos', label: 'Alunos', icon: '👥', roles: ['admin', 'professor'] },
  { path: '/planos', label: 'Planos', icon: '💳', roles: ['admin', 'professor'] },
  { path: '/matriculas', label: 'Matrículas', icon: '📋', roles: ['admin', 'professor'] },
  { path: '/checkin', label: 'Check-in', icon: '🚪', roles: ['admin', 'professor'] },
  { path: '/professores', label: 'Professores', icon: '👨‍🏫', roles: ['admin'] },
];

const TREINAMENTO_SUBMENU = [
  { path: '/treinos', label: 'Treinos dos Alunos', icon: '🏋️', roles: ['admin', 'professor'] },
  { path: '/treinos/modelos', label: 'Modelos de Treino', icon: '📑', roles: ['admin', 'professor'] },
  { path: '/treinos/exercicios', label: 'Biblioteca de Exercícios', icon: '💪', roles: ['admin', 'professor'] },
  { path: '/treinos/grupos-musculares', label: 'Grupos Musculares', icon: '🧬', roles: ['admin', 'professor'] },
  { path: '/treinos/configuracoes', label: 'Configurações de Treinamento', icon: '⚙️', roles: ['admin', 'professor'] },
  { path: '/treinos/acompanhamento', label: 'Acompanhamento', icon: '📈', roles: ['admin', 'professor'] },
];

const FINANCEIRO_SUBMENU = [
  { path: '/financeiro/vendas', label: 'Vendas', icon: '🛒', roles: ['admin'] },
  { path: '/financeiro/receber', label: 'Contas a Receber', icon: '📥', roles: ['admin'] },
  { path: '/financeiro/pagar', label: 'Contas a Pagar', icon: '📤', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('wcfit_theme') || 'light');

  const rotaTreinamentoAtiva = location.pathname.startsWith('/treinos');
  const [treinamentoAberto, setTreinamentoAberto] = useState(rotaTreinamentoAtiva);

  const rotaFinanceiroAtiva = location.pathname.startsWith('/financeiro');
  const [financeiroAberto, setFinanceiroAberto] = useState(rotaFinanceiroAtiva);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wcfit_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (rotaTreinamentoAtiva) {
      setTreinamentoAberto(true);
    }
  }, [rotaTreinamentoAtiva]);

  useEffect(() => {
    if (rotaFinanceiroAtiva) {
      setFinanceiroAberto(true);
    }
  }, [rotaFinanceiroAtiva]);

  if (!usuario) {
    return null;
  }

  const cargo = usuario.cargo;
  const itens = MENU_ITEMS.filter((item) => {
    if (!cargo) return false;
    return item.roles.includes(cargo);
  });

  const submenusTreinamento = TREINAMENTO_SUBMENU.filter((sub) => {
    if (!cargo) return false;
    return sub.roles.includes(cargo);
  });

  const submenusFinanceiro = FINANCEIRO_SUBMENU.filter((sub) => {
    if (!cargo) return false;
    return sub.roles.includes(cargo);
  });

  const isActive = (path) => location.pathname === path;

  return (
    <div className="layout-app-container">
      {/* Sidebar Moderna */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-badge">WF</div>
          <div>
            <h2>Wc Fit</h2>
            <p>Gestão para Academias</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-title">Menu Principal</span>
          <ul>
            {itens.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={isActive(item.path) ? 'active' : ''}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}

            {submenusTreinamento.length > 0 && (
              <li className={`nav-group ${rotaTreinamentoAtiva ? 'has-active' : ''}`}>
                <button
                  type="button"
                  className={`nav-group-toggle ${rotaTreinamentoAtiva ? 'active' : ''}`}
                  onClick={() => setTreinamentoAberto((prev) => !prev)}
                  aria-expanded={treinamentoAberto}
                >
                  <span className="nav-group-left">
                    <span className="nav-icon">🏋️</span>
                    <span className="nav-label">Treinamento</span>
                  </span>
                  <span className="nav-chevron">{treinamentoAberto ? '▾' : '▸'}</span>
                </button>

                {treinamentoAberto && (
                  <ul className="nav-submenu">
                    {submenusTreinamento.map((sub) => (
                      <li key={sub.path}>
                        <Link
                          to={sub.path}
                          className={isActive(sub.path) ? 'active' : ''}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="nav-icon">{sub.icon}</span>
                          <span className="nav-label">{sub.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )}

            {submenusFinanceiro.length > 0 && (
              <li className={`nav-group ${rotaFinanceiroAtiva ? 'has-active' : ''}`}>
                <button
                  type="button"
                  className={`nav-group-toggle ${rotaFinanceiroAtiva ? 'active' : ''}`}
                  onClick={() => setFinanceiroAberto((prev) => !prev)}
                  aria-expanded={financeiroAberto}
                >
                  <span className="nav-group-left">
                    <span className="nav-icon">💰</span>
                    <span className="nav-label">Financeiro</span>
                  </span>
                  <span className="nav-chevron">{financeiroAberto ? '▾' : '▸'}</span>
                </button>

                {financeiroAberto && (
                  <ul className="nav-submenu">
                    {submenusFinanceiro.map((sub) => (
                      <li key={sub.path}>
                        <Link
                          to={sub.path}
                          className={isActive(sub.path) ? 'active' : ''}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className="nav-icon">{sub.icon}</span>
                          <span className="nav-label">{sub.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini-card">
            <div className="user-avatar">
              {usuario.nome ? usuario.nome.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="user-details">
              <span className="user-name">{usuario.nome}</span>
              <span className="user-role">{usuario.cargo}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-sair-sidebar"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            🚪 Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-content">
        <div className="top-theme-bar">
          <button
            type="button"
            className="theme-toggle theme-toggle-cinza"
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            aria-label="Alternar tema"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro de leitura'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
        {children || <Outlet />}
      </main>
    </div>
  );
}