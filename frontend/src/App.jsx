import { lazy, Suspense } from 'react';
import './styles/styles.css';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import { moduloPorRota, podeAcessar } from './permissoesProfessor';
import Layout from './components/Layout';

function carregarPagina(importar) {
  const Pagina = lazy(importar);
  return function PaginaSobDemanda(props) {
    return <Suspense fallback={<p role="status" className="relatorio-vazio">Carregando página…</p>}>
      <Pagina {...props} />
    </Suspense>;
  };
}

const PortalAluno = carregarPagina(() => import('./pages/PortalAluno'));
const Comercial = carregarPagina(() => import('./pages/Comercial'));
const SuperAdmin = carregarPagina(() => import('./pages/SuperAdmin'));
const Planos = carregarPagina(() => import('./pages/Planos'));
const Alunos = carregarPagina(() => import('./pages/Alunos'));
const AlunoDetalhes = carregarPagina(() => import('./pages/AlunoDetalhes'));
const Treinos = carregarPagina(() => import('./pages/Treinos'));
const Exercicios = carregarPagina(() => import('./pages/Exercicios'));
const GruposMusculares = carregarPagina(() => import('./pages/GruposMusculares'));
const ModelosTreino = carregarPagina(() => import('./pages/ModelosTreino'));
const ConfiguracoesAcademia = carregarPagina(() => import('./pages/ConfiguracoesAcademia'));
const ConfiguracoesTreino = carregarPagina(() => import('./pages/ConfiguracoesTreino'));
const AcompanhamentoTreinos = carregarPagina(() => import('./pages/AcompanhamentoTreinos'));
const Checkin = carregarPagina(() => import('./pages/Checkin'));
const Matriculas = carregarPagina(() => import('./pages/Matriculas'));
const Dashboard = carregarPagina(() => import('./pages/Dashboard'));
const Professores = carregarPagina(() => import('./pages/Professores'));
const Financeiro = carregarPagina(() => import('./pages/Financeiro'));
const SuperAdminPainel = carregarPagina(() => import('./pages/SuperAdminPainel'));
const AceitarConvite = carregarPagina(() => import('./pages/AceitarConvite'));
const CadastroAdmin = carregarPagina(() => import('./pages/CadastroAdmin'));
const ConfirmarConta = carregarPagina(() => import('./pages/ConfirmarConta'));

function VerificarModulo() {
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  const modulo = moduloPorRota[pathname] || (pathname.startsWith('/alunos/') ? 'alunos' : null);
  if (usuario?.cargo === 'professor' && ['/financeiro','/professores','/configuracoes']
    .some((rota) => pathname === rota || pathname.startsWith(rota + '/'))) {
    return <p role="status">Este módulo é reservado ao administrador.</p>;
  }
  if (usuario?.cargo === 'professor' && usuario.permissoes === undefined) return <p role="status">Carregando permissões…</p>;
  if (!podeAcessar(usuario, modulo)) return <p role="status">Você não tem acesso a este módulo.</p>;
  return <Outlet />;
}

function App() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return null;
  }

  return (
    <Routes>
      <Route path="/" element={<Comercial />} />
      <Route path="/aluno/login" element={<PortalAluno tela="login" />} />
      <Route path="/aluno" element={<PortalAluno tela="inicio" />} />
      <Route path="/aluno/treinos" element={<PortalAluno tela="treinos" />} />
      <Route path="/aluno/treino/:fichaId" element={<PortalAluno tela="ficha" />} />
      <Route path="/aluno/execucao/:fichaId" element={<PortalAluno tela="execucao" />} />
      <Route path="/aluno/evolucao" element={<PortalAluno tela="evolucao" />} />
      <Route path="/aluno/historico" element={<PortalAluno tela="historico" />} />
      <Route path="/aluno/matricula" element={<PortalAluno tela="matricula" />} />
      <Route path="/aluno/perfil" element={<PortalAluno tela="perfil" />} />
      <Route path="/aceitar-convite" element={<AceitarConvite />} />
      <Route path="/cadastro" element={<CadastroAdmin />} />
      <Route path="/confirmar-conta" element={<ConfirmarConta />} />
      <Route path="/super-admin/login" element={<SuperAdmin />} />
      <Route path="/super-admin/:modulo?" element={<SuperAdminPainel />} />
      {!usuario ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <Route element={<Layout />}>
          <Route element={<VerificarModulo />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/alunos" element={<Alunos />} />
          <Route path="/alunos/:id" element={<AlunoDetalhes />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/treinos/exercicios" element={<Exercicios />} />
          <Route path="/treinos/grupos-musculares" element={<GruposMusculares />} />
          <Route path="/treinos/modelos" element={<ModelosTreino />} />
          <Route path="/treinos/configuracoes" element={<ConfiguracoesTreino />} />
          <Route path="/treinos/acompanhamento" element={<AcompanhamentoTreinos />} />
          <Route path="/matriculas" element={<Matriculas />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/configuracoes/:secao?" element={<ConfiguracoesAcademia />} />
          <Route path="/professores" element={<Professores />} />
          <Route path="/financeiro" element={<Navigate to="/financeiro/vendas" replace />} />
          <Route path="/financeiro/vendas" element={<Financeiro abaInicial="venda" />} />
          <Route path="/financeiro/receber" element={<Financeiro abaInicial="receber" />} />
          <Route path="/financeiro/pagar" element={<Financeiro abaInicial="pagar" />} />
          <Route path="/logout" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      )}
    </Routes>
  );
}

export default App;
