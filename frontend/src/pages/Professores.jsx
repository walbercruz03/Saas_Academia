import { Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/professor.css';

export default function Professores() {
  const [professores, setProfessores] = useState([]);
  const [professor, setProfessor] = useState({ nome: '', email_ou_matricula: '', senha: '', cargo: 'professor' });
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { carregarProfessores(); }, []);

  const carregarProfessores = async () => {
    try {
      const res = await api.get('/usuarios');
      setProfessores(res.data.filter((u) => u.cargo === 'professor') || []);
    } catch {
      setErro('Erro ao carregar professores.');
    }
  };

  const handleChange = (e) => {
    setProfessor({ ...professor, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);
    try {
      if (editingId) {
        const dadosEnvio = { ...professor };
        if (!dadosEnvio.senha) delete dadosEnvio.senha; // Não sobrescreve a senha se ficar em branco na edição

        await api.put(`/usuarios/${editingId}`, dadosEnvio);
        setSucesso('Professor atualizado com sucesso!');
        setEditingId(null);
      } else {
        await api.post('/usuarios', professor);
        setSucesso('Professor cadastrado com sucesso!');
      }
      setProfessor({ nome: '', email_ou_matricula: '', senha: '', cargo: 'professor' });
      carregarProfessores();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao salvar professor.');
    } finally {
      setCarregando(false);
    }
  };

  const editar = (p) => {
    setProfessor({ nome: p.nome, email_ou_matricula: p.email_ou_matricula, senha: '', cargo: 'professor' });
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluir = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este professor?')) return;
    try {
      await api.delete(`/usuarios/${id}`);
      carregarProfessores();
      setSucesso('Professor excluído com sucesso.');
    } catch {
      setErro('Erro ao excluir professor.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Professores</h2>
          <p>Cadastro e gestão da equipe de professores</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      {erro && <div className="msg-erro">{erro}</div>}
      {sucesso && <div className="msg-sucesso">{sucesso}</div>}

      <div className="form-card">
        <h3>{editingId ? 'Editar Professor' : 'Novo Professor'}</h3>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="campo">
            <label htmlFor="nome">Nome completo</label>
            <input id="nome" name="nome" type="text" placeholder="Nome do professor" value={professor.nome} onChange={handleChange} required />
          </div>
          <div className="campo">
            <label htmlFor="email_ou_matricula">E-mail / Matrícula</label>
            <input id="email_ou_matricula" name="email_ou_matricula" type="text" placeholder="prof@academia.com" value={professor.email_ou_matricula} onChange={handleChange} required />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha {editingId && '(deixe em branco para manter)'}</label>
            <input id="senha" name="senha" type="password" placeholder="••••••••" value={professor.senha} onChange={handleChange} required={!editingId} />
          </div>
          <div className="btn-grupo" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-salvar" disabled={carregando}>
              {carregando ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setProfessor({ nome: '', email_ou_matricula: '', senha: '', cargo: 'professor' }); }}
                className="btn-outline"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <h3 className="titulo-listagem">Professores Cadastrados</h3>
      {professores.length === 0 ? (
        <div className="lista-vazia">Nenhum professor cadastrado.</div>
      ) : (
        <div className="tabela-scroll" role="region" aria-label="Tabela de professores" tabIndex={0}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail / Matrícula</th>
                <th>Cargo</th>
                <th>Status</th>
                <th className="acao-col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {professores.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nome}</strong></td>
                  <td>{p.email_ou_matricula}</td>
                  <td><span className="badge badge-ativo">{p.cargo}</span></td>
                  <td><span className="badge badge-ativo">{p.status || 'ativo'}</span></td>
                  <td className="acao-col">
                    <button onClick={() => editar(p)} className="btn-icon"><Pencil size={16} aria-hidden="true" /> Editar</button>
                    <button onClick={() => excluir(p.id)} className="btn-icon btn-icon--perigo"><Trash2 size={16} aria-hidden="true" /> Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}