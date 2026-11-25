import PropTypes from 'prop-types';
import { Check, Trash2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const armazenamentoOperacao = `wcfit:financeiro:pendente:${usuario?.academia_id}:${usuario?.id}:${tipoAtual}`;
  const envioEmCurso = useRef(false);
  const baixasEmCurso = useRef(new Set());

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);
  const [totais, setTotais] = useState({ geral: 0, pago: 0, pendente: 0 });
  const [alunos, setAlunos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [periodoAplicado, setPeriodoAplicado] = useState({ inicio: '', fim: '' });
  const [erroPeriodo, setErroPeriodo] = useState('');
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
    let dadosPendentes;
    try {
      dadosPendentes = JSON.parse(sessionStorage.getItem(armazenamentoOperacao))?.dados;
    } catch {
      // O envio exige que a referência da tentativa possa ser guardada.
    }
    setForm((prev) => ({
      ...prev,
      categoria: tipoAtual === 'pagar' ? 'despesa_operacional' : 'mensalidade',
      status: CONFIG_TIPOS[tipoAtual].statusPadrao,
      aluno_id: tipoAtual === 'pagar' ? '' : prev.aluno_id,
      plano_id: tipoAtual === 'pagar' ? '' : prev.plano_id,
      ...(dadosPendentes && {
        ...dadosPendentes,
        aluno_id: dadosPendentes.aluno_id ?? '',
        plano_id: dadosPendentes.plano_id ?? '',
        observacoes: dadosPendentes.observacoes ?? '',
      }),
    }));
    setFiltroStatus('');
    setPagina(1);
    setMensagem('');
    setErro('');
  }, [tipoAtual, location.pathname, armazenamentoOperacao]);

  useEffect(() => {
    const controle = new AbortController();
    const config = { signal: controle.signal };
    Promise.all([
      api.get('/alunos', { ...config, params: { resumo: '1' } }).catch(() => ({ data: [] })),
      api.get('/planos', config).catch(() => ({ data: [] })),
    ]).then(([alunosRes, planosRes]) => {
      if (controle.signal.aborted) return;
      setAlunos(Array.isArray(alunosRes.data) ? alunosRes.data : []);
      setPlanos(Array.isArray(planosRes.data) ? planosRes.data : []);
    });
    return () => controle.abort();
  }, []);

  const consultaDados = useRef(null);
  const filtrosDados = useRef(null);
  filtrosDados.current = { tipo: tipoAtual, pagina, ...(filtroStatus ? { status: filtroStatus } : {}),
    ...(periodoAplicado.inicio && periodoAplicado.fim ? periodoAplicado : {}) };
  const carregarDados = useCallback(async () => {
    consultaDados.current?.abort();
    const controle = new AbortController();
    consultaDados.current = controle;
    setCarregando(true);
    setErro('');
    try {
      const parametros = filtrosDados.current;
      const { data } = await api.get('/financeiro', { params: parametros, signal: controle.signal });
      if (controle.signal.aborted) return;
      if (!data.registros.length && parametros.pagina > 1) {
        setPagina(parametros.pagina - 1);
        return;
      }
      setMovimentacoes(data.registros);
      setTotais(data.totais);
      setTemMais(data.temMais);
    } catch (erro) {
      if (!controle.signal.aborted) {
        setErro(erro?.response?.data?.mensagem || 'Erro ao carregar movimentações financeiras.');
      }
    } finally {
      if (!controle.signal.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
    return () => consultaDados.current?.abort();
  }, [carregarDados, tipoAtual, filtroStatus, pagina, periodoAplicado.inicio, periodoAplicado.fim]);

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
    if (envioEmCurso.current) return;
    envioEmCurso.current = true;
    setSalvando(true);
    setMensagem('');
    setErro('');

    let operacao;
    try {
      const dados = {
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
      };
      operacao = JSON.parse(sessionStorage.getItem(armazenamentoOperacao));
      if (operacao && JSON.stringify(operacao.dados) !== JSON.stringify(dados)) {
        setForm((prev) => ({
          ...prev,
          ...operacao.dados,
          aluno_id: operacao.dados.aluno_id ?? '',
          plano_id: operacao.dados.plano_id ?? '',
          observacoes: operacao.dados.observacoes ?? '',
        }));
        setErro('Há um envio anterior sem confirmação. Os dados foram restaurados. Clique em Salvar para consultar o resultado.');
        return;
      }
      if (!operacao) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        operacao = { chave: Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''), dados };
        sessionStorage.setItem(armazenamentoOperacao, JSON.stringify(operacao));
      }
      await api.post('/financeiro', operacao.dados, { headers: { 'Idempotency-Key': operacao.chave } });
      sessionStorage.removeItem(armazenamentoOperacao);

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
      if ([400, 404].includes(e?.response?.status)) {
        sessionStorage.removeItem(armazenamentoOperacao);
      }
      setErro(e?.response?.data?.mensagem || (operacao
        ? 'O envio não foi confirmado. Clique em Salvar para repetir a mesma operação.'
        : 'Não foi possível guardar a referência da operação neste navegador.'));
    } finally {
      envioEmCurso.current = false;
      setSalvando(false);
    }
  };

  const handleBaixar = async (item) => {
    if (baixasEmCurso.current.has(item.id)) return;
    baixasEmCurso.current.add(item.id);
    setMensagem('');
    setErro('');
    try {
      const resposta = await api.patch(`/financeiro/${item.id}/baixar`, {
        forma_pagamento: item.forma_pagamento || 'pix',
        parcelas: item.parcelas || 1,
      });
      setMensagem(resposta.data.mensagem);
      await carregarDados();
    } catch (e) {
      setErro(e?.response?.data?.mensagem || 'Erro ao confirmar pagamento.');
    } finally {
      baixasEmCurso.current.delete(item.id);
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

  const aplicarPeriodo = (e) => {
    e.preventDefault();
    if ((dataInicial && !dataFinal) || (!dataInicial && dataFinal)) {
      setErroPeriodo('Selecione as duas datas para filtrar.');
      return;
    }
    if (dataInicial && dataFinal && dataInicial > dataFinal) {
      setErroPeriodo('A data inicial não pode ser posterior à data final.');
      return;
    }
    setErroPeriodo('');
    setPagina(1);
    setPeriodoAplicado({ inicio: dataInicial, fim: dataFinal });
  };

  const limparPeriodo = () => {
    setDataInicial('');
    setDataFinal('');
    setPagina(1);
    setPeriodoAplicado({ inicio: '', fim: '' });
    setErroPeriodo('');
  };

  const { geral: totalGeral, pago: totalPago, pendente: totalPendente } = totais;

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
            onChange={(e) => { setFiltroStatus(e.target.value); setPagina(1); }}
          >
            <option value="">Todos os status</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

      {/* Filtro personalizado por data de vencimento */}
      <form className="fin-periodo-box" onSubmit={aplicarPeriodo}>
        <div className="fin-periodo-cabecalho">
          <h3>Filtrar por período</h3>
          <span>Data de vencimento / lançamento</span>
        </div>
        <div className="fin-periodo-controles">
          <div className="fin-campo">
            <label htmlFor="fin-data-inicial">Data inicial</label>
            <input id="fin-data-inicial" type="date" value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)} />
          </div>
          <div className="fin-campo">
            <label htmlFor="fin-data-final">Data final</label>
            <input id="fin-data-final" type="date" value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)} />
          </div>
          <button className="fin-periodo-aplicar" type="submit">Filtrar</button>
          <button className="fin-periodo-limpar" type="button" onClick={limparPeriodo}>
            Limpar filtro
          </button>
        </div>
        {erroPeriodo && <p className="fin-periodo-erro" role="alert">{erroPeriodo}</p>}
        {periodoAplicado.inicio && periodoAplicado.fim && (
          <p className="fin-periodo-ativo">
            Exibindo de {formatarDataBR(periodoAplicado.inicio)} até {formatarDataBR(periodoAplicado.fim)}
          </p>
        )}
      </form>

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
                        {(m.status === 'pendente' || m.status === 'vencido') && (
                          <button
                            type="button"
                            className="fin-btn-acao fin-btn-baixar"
                            onClick={() => handleBaixar(m)}
                          >
                            <Check size={16} aria-hidden="true" /> Confirmar
                          </button>
                        )}
                        {usuario?.cargo === 'admin' && (
                          <button
                            type="button"
                            className="fin-btn-acao fin-btn-excluir"
                            onClick={() => handleExcluir(m.id)}
                          >
                            <Trash2 size={16} aria-hidden="true" /> Excluir
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
        {(pagina > 1 || temMais) && <div className="btn-grupo">
          <button type="button" className="btn-outline" disabled={carregando || pagina <= 1}
            onClick={() => setPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina}</span>
          <button type="button" className="btn-outline" disabled={carregando || !temMais}
            onClick={() => setPagina(pagina + 1)}>Próxima</button>
        </div>}
      </div>
    </div>
  );
}

Financeiro.propTypes = { abaInicial: PropTypes.oneOf(Object.keys(CONFIG_TIPOS)) };
