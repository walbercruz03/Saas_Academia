const { createHash } = require('node:crypto');
const { getDataHojeFortaleza, validarDataYMD } = require('../services/relatorioService');
const { promisify } = require('node:util');
const Aluno = require('../models/Aluno');
const Matricula = require('../models/Matricula');
const Plano = require('../models/Plano');
const Financeiro = require('../models/Financeiro');

const TIPOS_VALIDOS = ['venda', 'receber', 'pagar'];
const FORMAS_VALIDAS = ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'outro'];
const erroFinanceiro = (res, err, mensagem) => {
  if ((err.code === 'SQLITE_ERROR' || err.code === '42703') &&
      /academia_id/i.test(err.message)) {
    return res.status(503).json({ mensagem: 'Financeiro indisponível neste banco sem vínculo por academia.' });
  }
  return res.status(500).json({ mensagem });
};

const STATUS_VALIDOS = ['pendente', 'pago', 'vencido', 'cancelado'];

const listarMovimentacoes = (req, res) => {
  const { tipo, status, pagina, inicio, fim } = req.query;

  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ mensagem: 'Tipo financeiro inválido.' });
  }
  if (status && !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ mensagem: 'Status financeiro inválido.' });
  }
  if (pagina !== undefined && (typeof pagina !== 'string' || !/^[1-9]\d{0,5}$/.test(pagina))) {
    return res.status(400).json({ mensagem: 'Página inválida.' });
  }
  if (pagina !== undefined && (inicio !== undefined || fim !== undefined) &&
      (!validarDataYMD(inicio) || !validarDataYMD(fim) || inicio > fim)) {
    return res.status(400).json({ mensagem: 'Período financeiro inválido.' });
  }

  Financeiro.listar({ tipo, status, academiaId: req.usuario.academia_id,
    pagina: pagina === undefined ? undefined : Number(pagina), inicio, fim }, (err, rows) => {
    if (err) {
      return erroFinanceiro(res, err, 'Erro ao listar movimentações financeiras.');
    }
    return res.json(rows || []);
  });
};

const criarMovimentacao = async (req, res) => {
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
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
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

  if (data_vencimento && !validarDataYMD(data_vencimento)) {
    return res.status(400).json({ mensagem: 'Informe o vencimento no formato AAAA-MM-DD.' });
  }

  const chave = req.get('Idempotency-Key')?.toLowerCase();
  if (!chave || !/^[a-f0-9]{32}$/.test(chave)) {
    return res.status(400).json({ mensagem: 'Informe uma chave válida para identificar a operação.' });
  }

  const academiaId = req.usuario.academia_id;
  const dados = {
    tipo,
    academia_id: academiaId,
    categoria: categoria || (tipo === 'pagar' ? 'despesa' : 'mensalidade'),
    descricao: String(descricao).trim(),
    aluno_id: aluno_id ? Number(aluno_id) : null,
    matricula_id: matricula_id ? Number(matricula_id) : null,
    plano_id: plano_id ? Number(plano_id) : null,
    valor: valorNumerico,
    forma_pagamento,
    parcelas: forma_pagamento === 'cartao_credito' ? Math.max(1, Number(parcelas) || 1) : 1,
    status: statusFinal,
    data_vencimento: data_vencimento || null,
    observacoes: observacoes || null,
  };
  const resumo = createHash('sha256').update(JSON.stringify(dados)).digest('hex');

  try {
    let criado = await Financeiro.buscarReenvio(academiaId, { chave, resumo });
    if (!criado) {
      const vinculos = [[Aluno, aluno_id], [Matricula, matricula_id], [Plano, plano_id]];
      const registros = await Promise.all(vinculos.map(([model, id]) =>
        id ? promisify(model.findById)(id, academiaId) : null
      ));
      if (vinculos.some(([, id], i) => id && !registros[i])) {
        return res.status(404).json({ mensagem: 'Vínculo financeiro não encontrado.' });
      }
      const matricula = registros[1];
      if (matricula && (!matricula.aluno_id || !matricula.plano_id || (aluno_id && matricula.aluno_id !== Number(aluno_id)) ||
          (plano_id && matricula.plano_id !== Number(plano_id)))) {
        return res.status(400).json({ mensagem: 'Os vínculos financeiros são incompatíveis.' });
      }
      const agora = new Date();
      criado = await Financeiro.criar({
        ...dados,
        data_vencimento: dados.data_vencimento || getDataHojeFortaleza(agora),
        data_pagamento: statusFinal === 'pago' ? agora.toISOString() : null,
      }, { chave, resumo });
    }

    if (criado.conflito) {
      return res.status(409).json({ mensagem: 'Esta chave já foi usada com dados diferentes.' });
    }
    return res.status(criado.reutilizado ? 200 : 201).json({
      mensagem: criado.reutilizado ? 'Este lançamento já foi registrado.' : 'Lançamento registrado com sucesso.',
      id: criado.id,
    });
  } catch (err) {
    return erroFinanceiro(res, err, 'Erro ao registrar lançamento financeiro.');
  }
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
    req.usuario.academia_id,
    (err, resultado) => {
      if (err) {
        return erroFinanceiro(res, err, 'Erro ao confirmar pagamento.');
      }
      if (!resultado.status) {
        return res.status(404).json({ mensagem: 'Lançamento não encontrado.' });
      }
      if (resultado.status !== 'pago') {
        const emAberto = ['pendente', 'vencido'].includes(resultado.status);
        return res.status(409).json({ mensagem: emAberto
          ? 'Confira os vínculos do lançamento antes de confirmar o pagamento.'
          : 'O status atual do lançamento não permite confirmação.' });
      }
      return res.json({ mensagem: resultado.jaPago ? 'Pagamento já estava confirmado.' : 'Pagamento confirmado com sucesso.' });
    }
  );
};

const excluirMovimentacao = (req, res) => {
  const { id } = req.params;
  Financeiro.excluir(id, req.usuario.academia_id, (err, resultado) => {
    if (err) {
      return erroFinanceiro(res, err, 'Erro ao excluir lançamento.');
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
