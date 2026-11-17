import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/aluno.css';

export default function Alunos() {
  const [alunos, setAlunos] = useState([]);
  const [aluno, setAluno] = useState({ 
    nome: '', 
    cpf: '', 
    telefone: '', 
    email: '', 
    data_nascimento: '', 
    status: 'ativo', 
    contato_emergencia: '', 
    anamnese: '' 
  });
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { 
    carregarAlunos(); 
  }, []);

  const carregarAlunos = async () => {
    try { 
      const res = await api.get('/alunos'); 
      setAlunos(res.data || []); 
    } catch { 
      setErro('Erro ao carregar alunos.'); 
    }
  };

  const handleChange = (e) => { 
    setAluno({ ...aluno, [e.target.name]: e.target.value }); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setErro(''); 
    setSucesso(''); 
    setCarregando(true);
    
    try {
      if (editingId) { 
        await api.put(`/alunos/${editingId}`, aluno); 
        setSucesso('Aluno atualizado com sucesso!'); 
        setEditingId(null); 
      } else { 
        await api.post('/alunos', aluno); 
        setSucesso('Aluno cadastrado com sucesso!'); 
      }
      
      setAluno({ 
        nome: '', 
        cpf: '', 
        telefone: '', 
        email: '', 
        data_nascimento: '', 
        status: 'ativo', 
        contato_emergencia: '', 
        anamnese: '' 
      });
      carregarAlunos();
    } catch (err) { 
      setErro(err.response?.data?.mensagem || 'Erro ao salvar aluno.'); 
    } finally { 
      setCarregando(false); 
    }
  };

  const editar = (a) => { 
    setAluno({ 
      nome: a.nome || '', 
      cpf: a.cpf || '', 
      telefone: a.telefone || '', 
      email: a.email || '', 
      data_nascimento: a.data_nascimento ? a.data_nascimento.split('T')[0] : '', 
      status: a.status || 'ativo', 
      contato_emergencia: a.contato_emergencia || '', 
      anamnese: a.anamnese || '' 
    }); 
    setEditingId(a.id); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluir = async (id) => { 
    if (!confirm('Deseja realmente excluir este aluno?')) return; 
    try { 
      await api.delete(`/alunos/${id}`); 
      carregarAlunos(); 
      setSucesso('Aluno excluído com sucesso.'); 
    } catch { 
      setErro('Erro ao excluir aluno.'); 
    } 
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Alunos</h2>
          <p>Cadastro e gestão de alunos</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      {erro && <div className="msg-erro">{erro}</div>}
      {sucesso && <div className="msg-sucesso">{sucesso}</div>}

      <div className="form-card">
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Aluno' : 'Novo Aluno'}</h3>
        
        {/* O formulário agora envolve corretamente os campos E os botões */}
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="campo">
            <label>Nome</label>
            <input name="nome" type="text" value={aluno.nome} onChange={handleChange} required />
          </div>
          <div className="campo">
            <label>CPF</label>
            <input name="cpf" type="text" value={aluno.cpf} onChange={handleChange} />
          </div>
          <div className="campo">
            <label>Telefone</label>
            <input name="telefone" type="tel" value={aluno.telefone} onChange={handleChange} />
          </div>
          <div className="campo">
            <label>E-mail</label>
            <input name="email" type="email" value={aluno.email} onChange={handleChange} />
          </div>
          <div className="campo">
            <label>Nascimento</label>
            <input name="data_nascimento" type="date" value={aluno.data_nascimento} onChange={handleChange} />
          </div>
          <div className="campo">
            <label>Status</label>
            <select name="status" value={aluno.status} onChange={handleChange}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="inadimplente">Inadimplente</option>
            </select>
          </div>
          <div className="campo-full">
            <label>Anamnese</label>
            <textarea name="anamnese" rows="3" value={aluno.anamnese} onChange={handleChange} />
          </div>

          <div className="btn-grupo" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="btn-salvar" disabled={carregando}>
              {carregando ? 'Salvando...' : editingId ? 'Atualizar' : 'Cadastrar'}
            </button>
            {editingId && (
              <button 
                type="button" 
                onClick={() => { 
                  setEditingId(null); 
                  setAluno({ nome: '', cpf: '', telefone: '', email: '', data_nascimento: '', status: 'ativo', contato_emergencia: '', anamnese: '' }); 
                }} 
                className="btn-outline" 
                style={{ background: '#6b7280', color: '#fff', borderColor: '#6b7280' }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#111827' }}>Alunos Cadastrados</h3>
      {alunos.length === 0 ? (
        <div className="lista-vazia">Nenhum aluno cadastrado.</div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Status</th>
              <th className="acao-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.nome}</strong></td>
                <td>{a.cpf || '-'}</td>
                <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                <td className="acao-col">
                  <button onClick={() => editar(a)} className="btn-icon">Editar</button>
                  <button onClick={() => excluir(a.id)} className="btn-icon" style={{ color: '#dc2626' }}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}