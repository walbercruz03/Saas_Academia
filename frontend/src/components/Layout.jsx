
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';

import {
  LayoutDashboard,
  Users,
  CreditCard,
  ClipboardList,
  ScanLine,
  UserRoundCheck,
  Settings,
  Dumbbell,
  FileText,
  Library,
  Activity,
  SlidersHorizontal,
  TrendingUp,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  ChevronDown,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

import { moduloPorRota, podeAcessar } from '../permissoesProfessor';
import { useAuth } from '../contexts/AuthContext';
import '../styles/styles.css';
import '../styles/layout.css';

const MENU_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'professor'] },
  { path: '/alunos', label: 'Alunos', icon: Users, roles: ['admin', 'professor'] },
  { path: '/planos', label: 'Planos', icon: CreditCard, roles: ['admin', 'professor'] },
  { path: '/matriculas', label: 'Matrículas', icon: ClipboardList, roles: ['admin', 'professor'] },
  { path: '/checkin', label: 'Check-in', icon: ScanLine, roles: ['admin', 'professor'] },
  { path: '/professores', label: 'Professores', icon: UserRoundCheck, roles: ['admin'] },
];

const TREINAMENTO_SUBMENU = [
  { path: '/treinos', label: 'Treinos dos Alunos', icon: Dumbbell, roles: ['admin', 'professor'] },
  { path: '/treinos/modelos', label: 'Modelos de Treino', icon: FileText, roles: ['admin', 'professor'] },
  { path: '/treinos/exercicios', label: 'Biblioteca de Exercícios', icon: Library, roles: ['admin', 'professor'] },
  { path: '/treinos/grupos-musculares', label: 'Grupos Musculares', icon: Activity, roles: ['admin', 'professor'] },
  { path: '/treinos/configuracoes', label: 'Configurações de Treinamento', icon: SlidersHorizontal, roles: ['admin', 'professor'] },
  { path: '/treinos/acompanhamento', label: 'Acompanhamento', icon: TrendingUp, roles: ['admin', 'professor'] },
];

const FINANCEIRO_SUBMENU = [
  { path: '/financeiro/vendas', label: 'Vendas', icon: ShoppingCart, roles: ['admin'] },
  { path: '/financeiro/receber', label: 'Contas a Receber', icon: ArrowDownToLine, roles: ['admin'] },
  { path: '/financeiro/pagar', label: 'Contas a Pagar', icon: ArrowUpFromLine, roles: ['admin'] },
];

const CONFIGURACOES_ITEM = {
  path: '/configuracoes',
  label: 'Configurações',
  icon: Settings,
  roles: ['admin'],
};

function MenuIcon({ icon: Icon, size = 20 }) {
  return (
    <span className="nav-icon">
      <Icon
        size={size}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </span>
  );
}

export default function Layout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [theme, setTheme] = useState(
    () => localStorage.getItem('wcfit_theme') || 'light'
  );

  const rotaTreinamentoAtiva = location.pathname.startsWith('/treinos');

  const [treinamentoAberto, setTreinamentoAberto] =
    useState(rotaTreinamentoAtiva);

  const rotaFinanceiroAtiva = location.pathname.startsWith('/financeiro');

  const [financeiroAberto, setFinanceiroAberto] =
    useState(rotaFinanceiroAtiva);

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

    return (
      item.roles.includes(cargo) &&
      podeAcessar(usuario, moduloPorRota[item.path])
    );
  });

  const submenusTreinamento = TREINAMENTO_SUBMENU.filter((sub) => {
    if (!cargo) return false;

    return (
      sub.roles.includes(cargo) &&
      podeAcessar(usuario, moduloPorRota[sub.path])
    );
  });

  const submenusFinanceiro = FINANCEIRO_SUBMENU.filter((sub) => {
    if (!cargo) return false;
    return sub.roles.includes(cargo);
  });

  const podeAcessarConfiguracoes =
    CONFIGURACOES_ITEM.roles.includes(cargo) &&
    podeAcessar(usuario, moduloPorRota[CONFIGURACOES_ITEM.path]);

  const isActive = (path) =>
    location.pathname === path ||
    (
      path === '/configuracoes' &&
      location.pathname.startsWith('/configuracoes/')
    );

  return (
    <div className="layout-app-container">

      {/* Barra lateral */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        <div className="sidebar-header">
          <div className="logo-badge">WF</div>

          <div>
            <h2>Wc Fit</h2>
            <p>Gestão para Academias</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="nav-section-title">
            Menu Principal
          </span>

          <ul>

            {/* Menus principais */}
            {itens.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={isActive(item.path) ? 'active' : ''}
                  onClick={() => setSidebarOpen(false)}
                >
                  <MenuIcon icon={item.icon} />

                  <span className="nav-label">
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}

            {/* Treinamento */}
            {submenusTreinamento.length > 0 && (
              <li className={`nav-group ${rotaTreinamentoAtiva ? 'has-active' : ''}`}>

                <button
                  type="button"
                  className={`nav-group-toggle ${rotaTreinamentoAtiva ? 'active' : ''}`}
                  onClick={() => setTreinamentoAberto((prev) => !prev)}
                  aria-expanded={treinamentoAberto}
                >
                  <span className="nav-group-left">
                    <MenuIcon icon={Dumbbell} />

                    <span className="nav-label">
                      Treinamento
                    </span>
                  </span>

                  <span className="nav-chevron">
                    {treinamentoAberto ? (
                      <ChevronDown size={16} strokeWidth={1.8} />
                    ) : (
                      <ChevronRight size={16} strokeWidth={1.8} />
                    )}
                  </span>
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
                          <MenuIcon icon={sub.icon} size={18} />

                          <span className="nav-label">
                            {sub.label}
                          </span>
                        </Link>
                      </li>
                    ))}

                  </ul>
                )}
              </li>
            )}

            {/* Financeiro */}
            {submenusFinanceiro.length > 0 && (
              <li className={`nav-group ${rotaFinanceiroAtiva ? 'has-active' : ''}`}>

                <button
                  type="button"
                  className={`nav-group-toggle ${rotaFinanceiroAtiva ? 'active' : ''}`}
                  onClick={() => setFinanceiroAberto((prev) => !prev)}
                  aria-expanded={financeiroAberto}
                >
                  <span className="nav-group-left">
                    <MenuIcon icon={Wallet} />

                    <span className="nav-label">
                      Financeiro
                    </span>
                  </span>

                  <span className="nav-chevron">
                    {financeiroAberto ? (
                      <ChevronDown size={16} strokeWidth={1.8} />
                    ) : (
                      <ChevronRight size={16} strokeWidth={1.8} />
                    )}
                  </span>
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
                          <MenuIcon icon={sub.icon} size={18} />

                          <span className="nav-label">
                            {sub.label}
                          </span>
                        </Link>
                      </li>
                    ))}

                  </ul>
                )}
              </li>
            )}

            {/* Configurações - último item */}
            {podeAcessarConfiguracoes && (
              <li key={CONFIGURACOES_ITEM.path}>
                <Link
                  to={CONFIGURACOES_ITEM.path}
                  className={isActive(CONFIGURACOES_ITEM.path) ? 'active' : ''}
                  onClick={() => setSidebarOpen(false)}
                >
                  <MenuIcon icon={CONFIGURACOES_ITEM.icon} />

                  <span className="nav-label">
                    {CONFIGURACOES_ITEM.label}
                  </span>
                </Link>
              </li>
            )}

          </ul>
        </nav>

        {/* Rodapé da barra lateral */}
        <div className="sidebar-footer">

          <div className="user-mini-card">
            <div className="user-avatar">
              {usuario.nome
                ? usuario.nome.charAt(0).toUpperCase()
                : 'A'}
            </div>

            <div className="user-details">
              <span className="user-name">
                {usuario.nome}
              </span>

              <span className="user-role">
                {usuario.cargo}
              </span>
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
            <LogOut size={18} strokeWidth={1.8} />
            <span>Encerrar Sessão</span>
          </button>

        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="main-content">

        <div className="top-theme-bar">
          <button
            type="button"
            className="theme-toggle theme-toggle-cinza"
            onClick={() =>
              setTheme((prev) =>
                prev === 'dark' ? 'light' : 'dark'
              )
            }
            aria-label="Alternar tema"
            title={
              theme === 'dark'
                ? 'Modo claro'
                : 'Modo escuro de leitura'
            }
          >
            {theme === 'dark' ? (
              <Sun size={20} strokeWidth={1.8} />
            ) : (
              <Moon size={20} strokeWidth={1.8} />
            )}
          </button>
        </div>

        {children || <Outlet />}

      </main>
    </div>
  );
}
