import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import CadastroAdmin from './pages/CadastroAdmin';
import Planos from './pages/Planos';
import Alunos from './pages/Alunos';
import Treinos from './pages/Treinos';
import Exercicios from './pages/Exercicios';
import GruposMusculares from './pages/GruposMusculares';
import ModelosTreino from './pages/ModelosTreino';
import AcompanhamentoTreinos from './pages/AcompanhamentoTreinos';
import Checkin from './pages/Checkin';
import Matriculas from './pages/Matriculas';
import Dashboard from './pages/Dashboard';
import Professores from './pages/Professores';
import Financeiro from './pages/Financeiro';
import Layout from './components/Layout';

function App() {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return null;
  }

  return (
    <Routes>
      {!usuario ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro-admin" element={<CadastroAdmin />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/alunos" element={<Alunos />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/treinos/exercicios" element={<Exercicios />} />
          <Route path="/treinos/grupos-musculares" element={<GruposMusculares />} />
          <Route path="/treinos/modelos" element={<ModelosTreino />} />
          <Route path="/treinos/acompanhamento" element={<AcompanhamentoTreinos />} />
          <Route path="/matriculas" element={<Matriculas />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/professores" element={<Professores />} />
          <Route path="/financeiro" element={<Navigate to="/financeiro/vendas" replace />} />
          <Route path="/financeiro/vendas" element={<Financeiro abaInicial="venda" />} />
          <Route path="/financeiro/receber" element={<Financeiro abaInicial="receber" />} />
          <Route path="/financeiro/pagar" element={<Financeiro abaInicial="pagar" />} />
          <Route path="/logout" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;