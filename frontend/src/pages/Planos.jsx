import { Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';

export default function Planos() {
  const [planos, setPlanos] = useState([]);
  const [plano, setPlano] = useState({ nome: '', descricao: '', preco: '', duracao_meses: '', status: 'ativo' });
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => { 
    carregarPlanos(); 
  }, []);

  const carregarPlanos = async () => {
    try { 
      const res = await api.get('/planos'); 
      setPlanos(res.data || []); 
    } catch { 
      setErro('Erro ao carregar planos.'); 
    }
  };

  const handleChange = (e) => { 
    setPlano({ ...plano, [e.target.name]: e.target.value }); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setErro(''); 
    setSucesso(''); 
    setCarregando(true);
    
    try {
      if (editingId) { 
        await api.put(`/planos/${editingId}`, plano); 
        setSucesso('Plano atualizado com sucesso!'); 
        setEditingId(null); 
      } else { 
        await api.post('/planos', plano); 
        setSucesso('Plano criado com sucesso!'); 
      }
      
      setPlano({ nome: '', descricao: '', preco: '', duracao_meses: '', status: 'ativo' });
      carregarPlanos();
    } catch (err) { 
      setErro(err.response?.data?.mensagem || 'Erro ao salvar plano.'); 
    } finally { 
      setCarregando(false); 
    }
  };

  const editar = (p) => { 
    setPlano({ ...p }); 
    setEditingId(p.id); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluir = async (id) => { 
    if (!confirm('Deseja realmente excluir este plano?')) return; 
    try { 
      await api.delete(`/planos/${id}`); 
      carregarPlanos(); 
      setSucesso('Plano excluído com sucesso.'); 
    } catch { 
      setErro('Erro ao excluir plano.'); 
    } 
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Planos</h2>
          <p>Cadastro de planos de assinatura</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      {erro && <div className="msg-erro">{erro}</div>}
      {sucesso && <div className="msg-sucesso">{sucesso}</div>}

      <div className="form-card">
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Plano' : 'Novo Plano'}</h3>
        
        {/* O <form> agora engloba tanto os inputs quanto os botões de ação */}
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="campo">
            <label htmlFor="nome">Nome do Plano</label>
            <input id="nome" name="nome" type="text" placeholder="Ex: Mensal" value={plano.nome} onChange={handleChange} required />
          </div>
          
          <div className="campo">
            <label htmlFor="descricao">Descrição</label>
            <input id="descricao" name="descricao" type="text" placeholder="Descrição" value={plano.descricao} onChange={handleChange} />
          </div>
          
          <div className="campo">
            <label htmlFor="preco">Preço (R$)</label>
            <input id="preco" name="preco" type="number" step="0.01" value={plano.preco} onChange={handleChange} required />
          </div>
          
          <div className="campo">
            <label htmlFor="duracao_meses">Duração (meses)</label>
            <input id="duracao_meses" name="duracao_meses" type="number" value={plano.duracao_meses} onChange={handleChange} required />
          </div>
          
          <div className="campo">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" value={plano.status} onChange={handleChange}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
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
                  setPlano({ nome: '', descricao: '', preco: '', duracao_meses: '', status: 'ativo' }); 
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

      <h3 className="titulo-listagem">Planos Cadastrados</h3>
      {planos.length === 0 ? (
        <div className="lista-vazia">Nenhum plano cadastrado.</div>
      ) : (
        <div className="tabela-scroll" role="region" aria-label="Tabela de planos" tabIndex={0}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Preço</th>
                <th>Duração</th>
                <th>Status</th>
                <th className="acao-col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.nome}</strong></td>
                  <td>{Number(p.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td>{p.duracao_meses} mês(es)</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
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