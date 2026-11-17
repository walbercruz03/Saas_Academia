import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/checkin.css';

import Layout from '../components/Layout';

export default function Checkin() {
  const [cpf, setCpf] = useState('');
  const [aluno, setAluno] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [checkinCarregando, setCheckinCarregando] = useState(false);

  useEffect(() => { carregarCheckins(); }, []);

  const carregarCheckins = async () => {
    try { const res = await api.get('/checkin'); setCheckins(res.data || []); } catch { setErro('Erro ao carregar check-ins.'); }
  };

  const buscarAluno = async (e) => {
    e.preventDefault(); setErro(''); setSucesso(''); setAluno(null);
    if (!cpf.trim()) { setErro('Informe o CPF do aluno.'); return; }
    setBuscando(true);
    try {
      const res = await api.get('/checkin/buscar-aluno', { params: { cpf: cpf.replace(/\D/g, '') } });
      setAluno(res.data);
    } catch (err) { setAluno(null); setErro(err.response?.data?.mensagem || 'Aluno não encontrado.'); }
    finally { setBuscando(false); }
  };

  const realizarCheckin = async () => {
    if (!aluno) return;
    setCheckinCarregando(true);
    try {
      await api.post('/checkin', { aluno_id: aluno.id, status: 'presente', observacoes: 'Check-in via recepcao' });
      setSucesso('Check-in realizado para ' + aluno.nome + '!');
      setAluno(null); setCpf(''); carregarCheckins();
    } catch (err) { setErro(err.response?.data?.mensagem || 'Erro ao realizar check-in.'); }
    finally { setCheckinCarregando(false); }
  };

  const formatarCPF = (value) => value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  return (
    <Layout>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2>Check-in</h2>
            <p>Busque o aluno pelo CPF para liberar a entrada.</p>
          </div>
          <Link to="/dashboard" className="btn-voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> Voltar</Link>
        </div>

        <div className="form-card">
          <h3 style={{ marginTop: 0 }}>Buscar Aluno</h3>
          <form onSubmit={buscarAluno} className="form-grid">
            <div className="campo">
              <label htmlFor="cpf">CPF do Aluno</label>
              <input id="cpf" type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(formatarCPF(e.target.value))} maxLength="14" required />
            </div>
            <div className="campo">
              <button type="submit" className="btn-salvar" disabled={buscando}>{buscando ? 'Buscando...' : 'Buscar Aluno'}</button>
            </div>
          </form>

          {erro && <div className="msg-erro">{erro}</div>}
          {sucesso && <div className="msg-sucesso">{sucesso}</div>}

          {aluno && (
            <div className="form-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-heading)' }}>Aluno Encontrado</h4>
              <div className="campo"><label>Nome</label><p style={{ margin: 0, color: 'var(--text-body)' }}>{aluno.nome}</p></div>
              <div className="campo"><label>CPF</label><p style={{ margin: 0, color: 'var(--text-body)' }}>{aluno.cpf}</p></div>
              <div className="campo"><label>Status</label><p style={{ margin: 0, color: 'var(--text-body)' }}><span className={`badge badge-${aluno.status}`}>{aluno.status}</span></p></div>
              <div className="campo"><label>Telefone</label><p style={{ margin: 0, color: 'var(--text-body)' }}>{aluno.telefone || '-'}</p></div>
              <div className="btn-grupo btn-superior">
                <button onClick={realizarCheckin} className="btn-salvar" disabled={checkinCarregando}>{checkinCarregando ? 'Processando...' : 'Realizar Check-in'}</button>
              </div>
            </div>
          )}
        </div>

        <div className="form-card" style={{ marginTop: '1.5rem' }}>
          <div className="page-header" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Check-ins Recentes</h3>
            <Link to="/dashboard" className="btn-link">Voltar</Link>
          </div>
          {checkins.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum check-in registrado.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>CPF</th>
                  <th>Data/Hora</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.id}>
                    <td>{c.aluno_nome}</td>
                    <td>{c.aluno_cpf}</td>
                    <td>{new Date(c.data_checkin).toLocaleString('pt-BR')}</td>
                    <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
