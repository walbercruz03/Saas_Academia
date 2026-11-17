import { useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/styles.css';

const MENU_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'professor'] },
  { path: '/alunos', label: 'Alunos', icon: '👥', roles: ['admin', 'professor'] },
  { path: '/planos', label: 'Planos', icon: '💳', roles: ['admin', 'professor'] },
  { path: '/matriculas', label: 'Matrículas', icon: '📋', roles: ['admin', 'professor'] },
  { path: '/checkin', label: 'Check-in', icon: '🚪', roles: ['admin', 'professor'] },
  { path: '/professores', label: 'Professores', icon: '👨‍🏫', roles: ['admin'] },
];

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!usuario) {
    return null;
  }

  const cargo = usuario.cargo;
  const itens = MENU_ITEMS.filter((item) => {
    if (!cargo) return false;
    return item.roles.includes(cargo);
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
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-mini-card">
            <div className="user-avatar">{usuario.nome ? usuario.nome.charAt(0).toUpperCase() : 'A'}</div>
            <div className="user-details">
              <span className="user-name">{usuario.nome}</span>
              <span className="user-role">{usuario.cargo}</span>
            </div>
          </div>
          <button 
            className="btn-sair-sidebar"
            onClick={() => { logout(); navigate('/login'); }}
          >
            🚪 Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="main-content">
        {children || <Outlet />}
      </main>
    </div>
  );
}