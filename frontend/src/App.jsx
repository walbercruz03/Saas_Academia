import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import CadastroAdmin from './pages/CadastroAdmin';
import Planos from './pages/Planos';
import Alunos from './pages/Alunos';
import Checkin from './pages/Checkin';
import Matriculas from './pages/Matriculas';
import Dashboard from './pages/Dashboard';
import Professores from './pages/Professores'; // <-- Importe aqui
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
          <Route path="/matriculas" element={<Matriculas />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/professores" element={<Professores />} /> {/* <-- Rota adicionada */}
          <Route path="/logout" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default App;