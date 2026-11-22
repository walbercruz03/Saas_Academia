import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/matricula.css';

const FORM_VAZIO = {
  aluno_id: '',
  plano_id: '',
  data_inicio: '',
  data_vencimento: '',
  status: 'ativo',
  valor_pago: '',
};

const normalizarDataInput = (valor) => {
  if (!valor) return '';
  return String(valor).trim().slice(0, 10);
};

export default function Matriculas() {
  const [matriculas, setMatriculas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [matricula, setMatricula] = useState(FORM_VAZIO);
  const [editingId, setEditingId] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [a, p, m] = await Promise.all([
        api.get('/alunos'),
        api.get('/planos'),
        api.get('/matriculas'),
      ]);
      setAlunos(Array.isArray(a.data) ? a.data : []);
      setPlanos(Array.isArray(p.data) ? p.data : []);
      setMatriculas(Array.isArray(m.data) ? m.data : []);
    } catch {
      setErro('Erro ao carregar.');
    }
  };

  const handleChange = (e) => {
    setMatricula({ ...matricula, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);
    try {
      if (editingId) {
        await api.put(`/matriculas/${editingId}`, matricula);
        setSucesso('Matrícula atualizada!');
        setEditingId(null);
      } else {
        await api.post('/matriculas', matricula);
        setSucesso('Matrícula criada!');
      }
      setMatricula(FORM_VAZIO);
      carregarDados();
    } catch {
      setErro('Erro ao salvar matrícula.');
    } finally {
      setCarregando(false);
    }
  };

  const editar = (m) => {
    setMatricula({
      aluno_id: m.aluno_id ?? '',
      plano_id: m.plano_id ?? '',
      data_inicio: normalizarDataInput(m.data_inicio),
      data_vencimento: normalizarDataInput(m.data_vencimento),
      status: m.status || 'ativo',
      valor_pago: m.valor_pago ?? '',
    });
    setEditingId(m.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluir = async (id) => {
    if (!confirm('Excluir matrícula?')) return;
    try {
      await api.delete(`/matriculas/${id}`);
      carregarDados();
      setSucesso('Matrícula excluída.');
    } catch {
      setErro('Erro ao excluir.');
    }
  };

  const alunoNome = (id) => alunos.find((a) => a.id === id)?.nome || '-';
  const planoNome = (id) => planos.find((p) => p.id === id)?.nome || '-';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Matrículas</h2>
          <p>Vínculo Aluno + Plano</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      {erro && <div className="msg-erro">{erro}</div>}
      {sucesso && <div className="msg-sucesso">{sucesso}</div>}

      <div className="form-card">
        <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar Matrícula' : 'Nova Matrícula'}</h3>

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="campo">
            <label>Aluno</label>
            <select name="aluno_id" value={matricula.aluno_id} onChange={handleChange} required>
              <option value="">Selecionar</option>
              {alunos.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Plano</label>
            <select name="plano_id" value={matricula.plano_id} onChange={handleChange} required>
              <option value="">Selecionar</option>
              {planos.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.nome}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Início</label>
            <input name="data_inicio" type="date" value={matricula.data_inicio} onChange={handleChange} required />
          </div>
          <div className="campo">
            <label>Vencimento</label>
            <input name="data_vencimento" type="date" value={matricula.data_vencimento} onChange={handleChange} required />
          </div>
          <div className="campo">
            <label>Status</label>
            <select name="status" value={matricula.status} onChange={handleChange}>
              <option value="ativo">Ativo</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="campo">
            <label>Valor (R$)</label>
            <input name="valor_pago" type="number" step="0.01" value={matricula.valor_pago} onChange={handleChange} required />
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
                  setMatricula(FORM_VAZIO);
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

      <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#111827' }}>Matrículas Cadastradas</h3>
      {matriculas.length === 0 ? (
        <div className="lista-vazia">Nenhuma matrícula.</div>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Plano</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th className="acao-col">Ações</th>
            </tr>
          </thead>
          <tbody>
            {matriculas.map((m) => (
              <tr key={m.id}>
                <td>{alunoNome(m.aluno_id)}</td>
                <td>{planoNome(m.plano_id)}</td>
                <td>{normalizarDataInput(m.data_vencimento) || '-'}</td>
                <td><span className={`badge badge-${m.status}`}>{m.status}</span></td>
                <td className="acao-col">
                  <button onClick={() => editar(m)} className="btn-icon">Editar</button>
                  <button onClick={() => excluir(m.id)} className="btn-icon" style={{ color: '#dc2626' }}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}