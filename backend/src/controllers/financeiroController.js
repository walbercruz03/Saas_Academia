const Financeiro = require('../models/Financeiro');

const TIPOS_VALIDOS = ['venda', 'receber', 'pagar'];
const FORMAS_VALIDAS = ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'outro'];
const STATUS_VALIDOS = ['pendente', 'pago', 'vencido', 'cancelado'];

const listarMovimentacoes = (req, res) => {
  const { tipo, status } = req.query;

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ mensagem: 'Tipo financeiro inválido.' });
  }
  if (status && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ mensagem: 'Status financeiro inválido.' });
  }

  Financeiro.listar({ tipo, status }, (err, rows) => {
    if (err) {
      return res.status(500).json({ mensagem: 'Erro ao listar movimentações financeiras.' });
    }
    return res.json(rows || []);
  });
};

const criarMovimentacao = (req, res) => {
  const {
    tipo,
    categoria,
    descricao,
    aluno_id,
    matricula_id,
    plano_id,
    valor,
    forma_pagamento = 'pix',
    parcelas = 1,
    status,
    data_vencimento,
    observacoes,
  } = req.body;

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ mensagem: 'Informe um tipo válido: venda, receber ou pagar.' });
  }
  if (!descricao || !String(descricao).trim()) {
    return res.status(400).json({ mensagem: 'A descrição é obrigatória.' });
  }
  const valorNumerico = Number(valor);
  if (Number.isNaN(valorNumerico) || valorNumerico <= 0) {
    return res.status(400).json({ mensagem: 'Informe um valor maior que zero.' });
  }
  if (forma_pagamento && !FORMAS_VALIDAS.includes(forma_pagamento)) {
    return res.status(400).json({ mensagem: 'Forma de pagamento inválida.' });
  }

  // Venda no balcão já nasce como 'pago' por padrão se não vier status explícito
  const statusFinal = status || (tipo === 'venda' ? 'pago' : 'pendente');
  if (!STATUS_VALIDOS.includes(statusFinal)) {
    return res.status(400).json({ mensagem: 'Status inválido.' });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const vencimentoFinal = data_vencimento || hoje;
  const dataPagamentoFinal = statusFinal === 'pago' ? new Date().toISOString() : null;

  Financeiro.criar(
    {
      tipo,
      categoria: categoria || (tipo === 'pagar' ? 'despesa' : 'mensalidade'),
      descricao: String(descricao).trim(),
      aluno_id: aluno_id || null,
      matricula_id: matricula_id || null,
      plano_id: plano_id || null,
      valor: valorNumerico,
      forma_pagamento,
      parcelas: forma_pagamento === 'cartao_credito' ? Math.max(1, Number(parcelas) || 1) : 1,
      status: statusFinal,
      data_vencimento: vencimentoFinal,
      data_pagamento: dataPagamentoFinal,
      observacoes: observacoes || null,
    },
    (err, criado) => {
      if (err) {
        return res.status(500).json({ mensagem: 'Erro ao registrar lançamento financeiro.' });
      }
      return res.status(201).json({
        mensagem: 'Lançamento registrado com sucesso.',
        id: criado.id,
      });
    }
  );
};

const confirmarPagamento = (req, res) => {
  const { id } = req.params;
  const { forma_pagamento, parcelas, observacoes } = req.body;

  if (forma_pagamento && !FORMAS_VALIDAS.includes(forma_pagamento)) {
    return res.status(400).json({ mensagem: 'Forma de pagamento inválida.' });
  }

  Financeiro.baixarPagamento(
    id,
    {
      forma_pagamento: forma_pagamento || 'pix',
      parcelas: forma_pagamento === 'cartao_credito' ? Math.max(1, Number(parcelas) || 1) : 1,
      data_pagamento: new Date().toISOString(),
      observacoes,
    },
    (err, resultado) => {
      if (err) {
        return res.status(500).json({ mensagem: 'Erro ao confirmar pagamento.' });
      }
      if (!resultado?.changes) {
        return res.status(404).json({ mensagem: 'Lançamento não encontrado.' });
      }
      return res.json({ mensagem: 'Pagamento confirmado com sucesso.' });
    }
  );
};

const excluirMovimentacao = (req, res) => {
  const { id } = req.params;
  Financeiro.excluir(id, (err, resultado) => {
    if (err) {
      return res.status(500).json({ mensagem: 'Erro ao excluir lançamento.' });
    }
    if (!resultado?.changes) {
      return res.status(404).json({ mensagem: 'Lançamento não encontrado.' });
    }
    return res.json({ mensagem: 'Lançamento excluído com sucesso.' });
  });
};

module.exports = {
  listarMovimentacoes,
  criarMovimentacao,
  confirmarPagamento,
  excluirMovimentacao,
};