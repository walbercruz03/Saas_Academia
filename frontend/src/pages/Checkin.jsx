import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import '../styles/styles.css';
import '../styles/checkin.css';

const normalizarTexto = (texto = '') =>
  String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const apenasDigitos = (valor = '') => String(valor).replace(/\D/g, '');

const formatarCPF = (value) =>
  apenasDigitos(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export default function Checkin() {
  const [termoBusca, setTermoBusca] = useState('');
  const [alunosCadastrados, setAlunosCadastrados] = useState([]);
  const [aluno, setAluno] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [checkinCarregando, setCheckinCarregando] = useState(false);

  useEffect(() => {
    carregarCheckins();
    carregarAlunos();
  }, []);

  const carregarCheckins = async () => {
    try {
      const res = await api.get('/checkin');
      setCheckins(res.data || []);
    } catch {
      setErro('Erro ao carregar check-ins.');
    }
  };

  const carregarAlunos = async () => {
    try {
      const res = await api.get('/alunos');
      setAlunosCadastrados(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAlunosCadastrados([]);
    }
  };

  const alunosSugeridos = useMemo(() => {
    const bruto = termoBusca.trim();
    if (!bruto || alunosCadastrados.length === 0) return [];

    const digitos = apenasDigitos(bruto);
    const textoNorm = normalizarTexto(bruto);

    return alunosCadastrados
      .filter((item) => {
        const matchNome =
          textoNorm.length >= 2 && normalizarTexto(item.nome || '').includes(textoNorm);
        const matchCpf =
          digitos.length >= 3 && apenasDigitos(item.cpf || '').includes(digitos);
        return matchNome || matchCpf;
      })
      .slice(0, 6);
  }, [termoBusca, alunosCadastrados]);

  const consultarAlunoPorCpf = async (cpfLimpo) => {
    const res = await api.get('/checkin/buscar-aluno', { params: { cpf: cpfLimpo } });
    return res.data;
  };

  const handleChangeBusca = (valor) => {
    setErro('');
    setSucesso('');
    setAluno(null);

    const semEspacos = valor.replace(/^\s+/, '');
    const apenasNums = apenasDigitos(semEspacos);
    const pareceCpf = /^[0-9.\-\s]+$/.test(semEspacos) && apenasNums.length > 0;

    if (pareceCpf) {
      setTermoBusca(formatarCPF(apenasNums));
    } else {
      setTermoBusca(semEspacos);
    }
  };

  const selecionarAlunoDaLista = async (itemAluno) => {
    setErro('');
    setSucesso('');
    setBuscando(true);
    try {
      const cpfLimpo = apenasDigitos(itemAluno.cpf || '');
      if (cpfLimpo) {
        const dadosCompletos = await consultarAlunoPorCpf(cpfLimpo);
        setAluno(dadosCompletos);
      } else {
        setAluno(itemAluno);
      }
      setTermoBusca(itemAluno.nome || formatarCPF(itemAluno.cpf || ''));
    } catch (err) {
      setAluno(itemAluno);
      setErro(err.response?.data?.mensagem || 'Não foi possível validar o check-in desse aluno.');
    } finally {
      setBuscando(false);
    }
  };

  const buscarAluno = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setAluno(null);

    const texto = termoBusca.trim();
    if (!texto) {
      setErro('Informe o nome ou CPF do aluno.');
      return;
    }

    const cpfLimpo = apenasDigitos(texto);
    setBuscando(true);

    try {
      if (cpfLimpo.length >= 11) {
        const dados = await consultarAlunoPorCpf(cpfLimpo.slice(0, 11));
        setAluno(dados);
      } else if (alunosSugeridos.length === 1) {
        await selecionarAlunoDaLista(alunosSugeridos[0]);
      } else if (alunosSugeridos.length > 1) {
        setErro('Selecione o aluno na lista abaixo para confirmar.');
      } else if (cpfLimpo.length > 0) {
        const dados = await consultarAlunoPorCpf(cpfLimpo);
        setAluno(dados);
      } else {
        setErro('Aluno não encontrado pelo nome informado.');
      }
    } catch (err) {
      setAluno(null);
      setErro(err.response?.data?.mensagem || 'Aluno não encontrado.');
    } finally {
      setBuscando(false);
    }
  };

  const realizarCheckin = async () => {
    if (!aluno) return;
    setCheckinCarregando(true);
    setErro('');
    try {
      await api.post('/checkin', {
        aluno_id: aluno.id,
        status: 'presente',
        observacoes: 'Check-in via recepcao',
      });
      setSucesso('Check-in realizado para ' + aluno.nome + '!');
      setAluno(null);
      setTermoBusca('');
      carregarCheckins();
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao realizar check-in.');
    } finally {
      setCheckinCarregando(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>Check-in</h2>
          <p>Busque o aluno pelo nome ou CPF para liberar a entrada.</p>
        </div>
        <Link to="/dashboard" className="btn-voltar">← Voltar</Link>
      </div>

      <div className="form-card">
        <h3 style={{ marginTop: 0 }}>Buscar Aluno</h3>
        <form onSubmit={buscarAluno} className="form-grid form-checkin">
          <div className="campo">
            <label htmlFor="busca-aluno">Nome ou CPF do Aluno</label>
            <input
              id="busca-aluno"
              type="text"
              placeholder="Digite o nome ou 000.000.000-00"
              value={termoBusca}
              onChange={(e) => handleChangeBusca(e.target.value)}
              autoComplete="off"
              required
            />

            {!aluno && alunosSugeridos.length > 0 && (
              <div className="checkin-sugestoes-lista">
                {alunosSugeridos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="checkin-sugestao-item"
                    onClick={() => selecionarAlunoDaLista(item)}
                  >
                    <span className="checkin-sugestao-nome">{item.nome}</span>
                    <span className="checkin-sugestao-cpf">
                      {item.cpf ? formatarCPF(item.cpf) : 'Sem CPF'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="campo">
            <button type="submit" className="btn-salvar" disabled={buscando}>
              {buscando ? 'Buscando...' : 'Buscar Aluno'}
            </button>
          </div>
        </form>

        {erro && <div className="msg-erro" style={{ marginTop: '1rem' }}>{erro}</div>}
        {sucesso && <div className="msg-sucesso" style={{ marginTop: '1rem' }}>{sucesso}</div>}

        {aluno && (
          <div
            className="form-card"
            style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}
          >
            <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-heading)' }}>
              Aluno Encontrado
            </h4>
            <div className="form-grid">
              <div className="campo">
                <label>Nome</label>
                <p style={{ margin: 0, color: 'var(--text-body)' }}>{aluno.nome}</p>
              </div>
              <div className="campo">
                <label>CPF</label>
                <p style={{ margin: 0, color: 'var(--text-body)' }}>{aluno.cpf}</p>
              </div>
              <div className="campo">
                <label>Status</label>
                <p style={{ margin: 0, color: 'var(--text-body)' }}>
                  <span className={`badge badge-${aluno.status}`}>{aluno.status}</span>
                </p>
              </div>
              <div className="campo">
                <label>Telefone</label>
                <p style={{ margin: 0, color: 'var(--text-body)' }}>{aluno.telefone || '-'}</p>
              </div>
            </div>
            <div className="btn-grupo">
              <button
                onClick={realizarCheckin}
                className="btn-salvar"
                disabled={checkinCarregando}
              >
                {checkinCarregando ? 'Processando...' : 'Realizar Check-in'}
              </button>
            </div>
          </div>
        )}
      </div>

      <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#111827' }}>Check-ins Recentes</h3>
      {checkins.length === 0 ? (
        <div className="lista-vazia">Nenhum check-in registrado.</div>
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
                <td>
                  <span className={`badge badge-${c.status}`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}