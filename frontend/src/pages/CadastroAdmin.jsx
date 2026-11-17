import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import '../styles/login.css';

export default function CadastroAdmin() {
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);
    try {
      await api.post('/auth/register-admin', {
        nome,
        idade: parseInt(idade) || undefined,
        cpf,
        email_ou_matricula: email,
        telefone,
        senha,
      });
      setSucesso('Administrador cadastrado com sucesso! Você já pode fazer login.');
      setNome('');
      setIdade('');
      setCpf('');
      setEmail('');
      setTelefone('');
      setSenha('');
    } catch (err) {
      setErro(
        err.response?.data?.mensagem ||
        'Erro ao cadastrar administrador. Tente novamente.'
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Wc Fit</h1>
          <p>Cadastro Inicial do Administrador</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="campo">
            <label htmlFor="nome">Nome completo</label>
            <input
              id="nome"
              type="text"
              placeholder="João da Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="idade">Idade</label>
            <input
              id="idade"
              type="number"
              placeholder="30"
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="cpf">CPF</label>
            <input
              id="cpf"
              type="text"
              placeholder="123.456.789-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              required
              maxLength="14"
            />
          </div>
          <div className="campo">
            <label htmlFor="email">E-mail / Matrícula</label>
            <input
              id="email"
              type="email"
              placeholder="wcfit@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="campo">
            <label htmlFor="telefone">Telefone</label>
            <input
              id="telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              required
            />
          </div>
          <div className="campo senha">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          {erro && <div className="erro">{erro}</div>}
          {sucesso && <div className="sucesso">{sucesso}</div>}
          <button type="submit" className="btn-entrar" disabled={carregando}>
            {carregando ? 'Cadastrando...' : 'Cadastrar Administrador'}
          </button>
        </form>
        <div className="cadastro-link">
          Já tem cadastro?{' '}
          <Link to="/login">Fazer login</Link>
        </div>
      </div>
    </div>
  );
}
