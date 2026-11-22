import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/styles.css';
import '../styles/financeiro.css';

const CONFIG_TIPOS = {
  venda: {
    rota: '/financeiro/vendas',
    titulo: 'Vendas',
    subtitulo: 'Registro e acompanhamento de vendas de planos, mensalidades e itens avulsos',
    statusPadrao: 'pago',
  },
  receber: {
    rota: '/financeiro/receber',
    titulo: 'Contas a Receber',
    subtitulo: 'Cobranças e valores previstos de alunos com baixa de recebimento',
    statusPadrao: 'pendente',
  },
  pagar: {
    rota: '/financeiro/pagar',
    titulo: 'Contas a Pagar',
    subtitulo: 'Despesas fixas e variáveis da academia com controle de pagamento',
    statusPadrao: 'pendente',
  },
};

const rotuloFormaPagamento = (forma, parcelas = 1) => {
  switch (forma) {
    case 'pix':
      return 'Pix';
    case 'cartao_credito':
      return parcelas > 1 ? `Cartão de Crédito (${parcelas}x)` : 'Cartão de Crédito (1x)';
    case 'cartao_debito':
      return 'Cartão de Débito';
    case 'dinheiro':
      return 'Dinheiro';
    default:
      return forma || '—';
  }
};

const formatarMoeda = (valor) => {
  const num = Number(valor);
  if (Number.isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatarDataBR = (valor) => {
  if (!valor) return '—';
  const match = String(valor).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(valor);
};

const hojeISO = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = partes.find((p) => p.type === 'year')?.value;
  const m = partes.find((p) => p.type === 'month')?.value;
  const d = partes.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
};

export default function Financeiro({ abaInicial = 'venda' }) {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tipoAtual = CONFIG_TIPOS[abaInicial] ? abaInicial : 'venda';
  const configAtual = CONFIG_TIPOS[tipoAtual];

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const [form, setForm] = useState({
    descricao: '',
    categoria: tipoAtual === 'pagar' ? 'despesa_operacional' : 'mensalidade',
    aluno_id: '',
    plano_id: '',
    valor: '',
    forma_pagamento: 'pix',
    parcelas: 1,
    status: configAtual.statusPadrao,
    data_vencimento: hojeISO(),
    observacoes: '',
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      categoria: tipoAtual === 'pagar' ? 'despesa_operacional' : 'mensalidade',
      status: CONFIG_TIPOS[tipoAtual].statusPadrao,
      aluno_id: tipoAtual === 'pagar' ? '' : prev.aluno_id,
      plano_id: tipoAtual === 'pagar' ? '' : prev.plano_id,
    }));
    setFiltroStatus('');
    setMensagem('');
    setErro('');
  }, [tipoAtual, location.pathname]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [movRes, alunosRes, planosRes] = await Promise.all([
        api.get('/financeiro', {
          params: {
            tipo: tipoAtual,
            ...(filtroStatus ? { status: filtroStatus } : {}),
          },
        }),
        api.get('/alunos').catch(() => ({ data: [] })),
        api.get('/planos').catch(() => ({ data: [] })),
      ]);

      setMovimentacoes(Array.isArray(movRes.data) ? movRes.data : []);
      setAlunos(Array.isArray(alunosRes.data) ? alunosRes.data : []);
      setPlanos(Array.isArray(planosRes.data) ? planosRes.data : []);
    } catch (e) {
      setErro(e?.response?.data?.mensagem || 'Erro ao carregar movimentações financeiras.');
    } finally {
      setCarregando(false);
    }
  }, [tipoAtual, filtroStatus]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handlePlanoChange = (planoId) => {
    const planoSelecionado = planos.find((p) => String(p.id) === String(planoId));
    setForm((prev) => ({
      ...prev,
      plano_id: planoId,
      descricao: planoSelecionado && !prev.descricao ? planoSelecionado.nome : prev.descricao,
      valor: planoSelecionado && planoSelecionado.preco != null ? planoSelecionado.preco : prev.valor,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setMensagem('');
    setErro('');

    try {
      await api.post('/financeiro', {
        tipo: tipoAtual,
        categoria: form.categoria,
        descricao: form.descricao,
        aluno_id: tipoAtual !== 'pagar' && form.aluno_id ? Number(form.aluno_id) : null,
        plano_id: tipoAtual !== 'pagar' && form.plano_id ? Number(form.plano_id) : null,
        valor: Number(form.valor),
        forma_pagamento: form.forma_pagamento,
        parcelas: form.forma_pagamento === 'cartao_credito' ? Number(form.parcelas) || 1 : 1,
        status: form.status,
        data_vencimento: form.data_vencimento || hojeISO(),
        observacoes: form.observacoes || null,
      });

      setMensagem('Lançamento salvo com sucesso.');
      setForm({
        descricao: '',
        categoria: tipoAtual === 'pagar' ? 'despesa_operacional' : 'mensalidade',
        aluno_id: '',
        plano_id: '',
        valor: '',
        forma_pagamento: form.forma_pagamento,
        parcelas: 1,
        status: configAtual.statusPadrao,
        data_vencimento: hojeISO(),
        observacoes: '',
      });
      await carregarDados();
    } catch (e) {
      setErro(e?.response?.data?.mensagem || 'Erro ao salvar lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  const handleBaixar = async (item) => {
    setMensagem('');
    setErro('');
    try {
      await api.patch(`/financeiro/${item.id}/baixar`, {
        forma_pagamento: item.forma_pagamento || 'pix',
        parcelas: item.parcelas || 1,
      });
      setMensagem('Pagamento confirmado com sucesso.');
      await carregarDados();
    } catch (e) {
      setErro(e?.response?.data?.mensagem || 'Erro ao confirmar pagamento.');
    }
  };

  const handleExcluir = async (id) => {
    setMensagem('');
    setErro('');
    try {
      await api.delete(`/financeiro/${id}`);
      setMensagem('Lançamento removido.');
      await carregarDados();
    } catch (e) {
      setErro(e?.response?.data?.mensagem || 'Erro ao remover lançamento.');
    }
  };

  const totalGeral = movimentacoes.reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  const totalPago = movimentacoes
    .filter((m) => m.status === 'pago')
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  const totalPendente = movimentacoes
    .filter((m) => m.status === 'pendente')
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0);

  return (
    <div className="fin-container">
      <div className="fin-header">
        <div>
          <h2>Financeiro • {configAtual.titulo}</h2>
          <p>{configAtual.subtitulo}</p>
        </div>
      </div>

      {/* Navegação entre os submenus */}
      <div className="fin-tabs">
        {Object.entries(CONFIG_TIPOS).map(([chave, cfg]) => (
          <button
            key={chave}
            type="button"
            className={`fin-tab-btn ${tipoAtual === chave ? 'ativo' : ''}`}
            onClick={() => navigate(cfg.rota)}
          >
            {cfg.titulo}
          </button>
        ))}
      </div>

      {mensagem && <div className="fin-alerta sucesso">{mensagem}</div>}
      {erro && <div className="fin-alerta erro">{erro}</div>}

      {/* Cards de Resumo */}
      <div className="fin-resumo-grid">
        <div className="fin-resumo-card">
          <div className="fin-resumo-label">Total Listado</div>
          <div className="fin-resumo-valor">{formatarMoeda(totalGeral)}</div>
        </div>

        <div className="fin-resumo-card pago">
          <div className="fin-resumo-label">
            {tipoAtual === 'pagar' ? 'Pago' : 'Recebido / Pago'}
          </div>
          <div className="fin-resumo-valor">{formatarMoeda(totalPago)}</div>
        </div>

        <div className="fin-resumo-card pendente">
          <div className="fin-resumo-label">Pendente</div>
          <div className="fin-resumo-valor">{formatarMoeda(totalPendente)}</div>
        </div>
      </div>

      {/* Formulário de Novo Lançamento */}
      <form onSubmit={handleSubmit} className="fin-form-box">
        <h3 className="fin-form-titulo">Novo lançamento em {configAtual.titulo}</h3>

        <div className="fin-form-grid">
          <div className="fin-campo">
            <label htmlFor="fin-descricao">Descrição *</label>
            <input
              id="fin-descricao"
              type="text"
              required
              placeholder={tipoAtual === 'pagar' ? 'Ex.: Conta de energia' : 'Ex.: Mensalidade / Plano'}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          {tipoAtual !== 'pagar' && (
            <>
              <div className="fin-campo">
                <label htmlFor="fin-aluno">Aluno (opcional)</label>
                <select
                  id="fin-aluno"
                  value={form.aluno_id}
                  onChange={(e) => setForm({ ...form, aluno_id: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fin-campo">
                <label htmlFor="fin-plano">Plano (opcional)</label>
                <select
                  id="fin-plano"
                  value={form.plano_id}
                  onChange={(e) => handlePlanoChange(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({formatarMoeda(p.preco)})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="fin-campo">
            <label htmlFor="fin-valor">Valor (R$) *</label>
            <input
              id="fin-valor"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </div>

          <div className="fin-campo">
            <label htmlFor="fin-forma">Forma de Pagamento</label>
            <select
              id="fin-forma"
              value={form.forma_pagamento}
              onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
            >
              <option value="pix">Pix</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>

          {form.forma_pagamento === 'cartao_credito' && (
            <div className="fin-campo">
              <label htmlFor="fin-parcelas">Parcelas</label>
              <select
                id="fin-parcelas"
                value={form.parcelas}
                onChange={(e) => setForm({ ...form, parcelas: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="fin-campo">
            <label htmlFor="fin-status">Status</label>
            <select
              id="fin-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="fin-campo">
            <label htmlFor="fin-data">Vencimento / Data</label>
            <input
              id="fin-data"
              type="date"
              value={form.data_vencimento}
              onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
            />
          </div>

          <div className="fin-campo">
            <button type="submit" disabled={salvando} className="fin-btn-salvar">
              {salvando ? 'Salvando...' : `Salvar em ${configAtual.titulo}`}
            </button>
          </div>
        </div>
      </form>

      {/* Filtro por Status + Tabela */}
      <div className="fin-tabela-box">
        <div className="fin-tabela-topo">
          <h3>Lançamentos • {configAtual.titulo}</h3>
          <select
            aria-label="Filtrar por status"
            className="fin-filtro-select"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {carregando ? (
          <div className="fin-vazio">Carregando lançamentos...</div>
        ) : movimentacoes.length === 0 ? (
          <div className="fin-vazio">Nenhum lançamento encontrado para {configAtual.titulo}.</div>
        ) : (
          <div className="fin-tabela-wrap">
            <table className="fin-tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  {tipoAtual !== 'pagar' && <th>Aluno</th>}
                  <th>Vencimento</th>
                  <th>Forma</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((m) => (
                  <tr key={m.id}>
                    <td>{m.descricao}</td>
                    {tipoAtual !== 'pagar' && <td>{m.aluno_nome || '—'}</td>}
                    <td>{formatarDataBR(m.data_vencimento)}</td>
                    <td>{rotuloFormaPagamento(m.forma_pagamento, m.parcelas)}</td>
                    <td>{formatarMoeda(m.valor)}</td>
                    <td>
                      <span className={`fin-badge ${m.status || ''}`}>{m.status}</span>
                    </td>
                    <td>
                      <div className="fin-acoes">
                        {m.status !== 'pago' && (
                          <button
                            type="button"
                            className="fin-btn-acao fin-btn-baixar"
                            onClick={() => handleBaixar(m)}
                          >
                            Confirmar
                          </button>
                        )}
                        {usuario?.cargo === 'admin' && (
                          <button
                            type="button"
                            className="fin-btn-acao fin-btn-excluir"
                            onClick={() => handleExcluir(m.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}