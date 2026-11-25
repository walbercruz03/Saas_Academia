const { createHash, timingSafeEqual } = require('node:crypto');
const { getDataHojeFortaleza, validarDataYMD } = require('../utils/datasFortaleza');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');

const base = 'https://api-sandbox.asaas.com/v3';
const meios = ['UNDEFINED', 'PIX', 'BOLETO', 'CREDIT_CARD'];
const erro = (status, mensagem, extras = {}) => Object.assign(new Error(mensagem), { status, ...extras });

function configuracao(env = process.env) {
  const { ASAAS_SANDBOX_ATIVO, ASAAS_SANDBOX_API_KEY, ASAAS_SANDBOX_NAMESPACE } = env;
  if (ASAAS_SANDBOX_ATIVO !== 'true' || !/^\$aact_hmlg_[!-~]+$/.test(ASAAS_SANDBOX_API_KEY || '') ||
      !/^[a-z0-9-]{4,32}$/.test(ASAAS_SANDBOX_NAMESPACE || '')) {
    throw erro(503, 'Asaas Sandbox indisponível.');
  }
  return { chave: ASAAS_SANDBOX_API_KEY, namespace: ASAAS_SANDBOX_NAMESPACE };
}

function referencia(namespace, tipo, academiaId, geracao) {
  if (!/^[a-z0-9-]{4,32}$/.test(namespace) || !['cliente','assinatura'].includes(tipo) ||
      !Number.isSafeInteger(academiaId) || academiaId < 1) throw erro(400, 'Referência Sandbox inválida.');
  if (geracao !== undefined && (!Number.isSafeInteger(geracao) || geracao < 1)) throw erro(400, 'Geração Sandbox inválida.');
  return `wcfit-${namespace}-${tipo}-${academiaId}${geracao === undefined ? '' : '-' + geracao}`;
}

function idValido(valor, prefixo) {
  return typeof valor === 'string' && valor.startsWith(prefixo + '_') && /^[a-zA-Z0-9_]{5,100}$/.test(valor);
}

function validarId(valor, prefixo) {
  if (!idValido(valor, prefixo)) throw erro(502, 'Identificador Asaas Sandbox inválido.');
  return valor;
}

function dadosCliente({ nome, documento, tipo, academiaId }, namespace) {
  const cpfCnpj = normalizarDocumento(documento, tipo);
  if (!cpfCnpj || typeof nome !== 'string' || !nome.trim() || nome.length > 160) {
    throw erro(400, 'Informe dados sintéticos válidos para o cliente Sandbox.');
  }
  return { name: nome.trim(), cpfCnpj, notificationDisabled: true,
    email: `wcfit-sandbox-${academiaId}@example.com`,
    phone: '1130000000', address: 'Rua Sintética', addressNumber: '100',
    postalCode: '01001000', province: 'Sé',
    externalReference: referencia(namespace, 'cliente', academiaId) };
}

function dadosAssinatura(dados, namespace, hoje = getDataHojeFortaleza()) {
  const { academiaId, cliente, mensalidadeCentavos, fimTeste, proximoVencimento, cortesiaAtiva, geracao,
    meio = 'UNDEFINED' } = dados;
  validarId(cliente, 'cus');
  if (!Number.isSafeInteger(mensalidadeCentavos) || mensalidadeCentavos < 1 ||
      !meios.includes(meio) || !validarDataYMD(fimTeste) || !validarDataYMD(proximoVencimento) ||
      typeof cortesiaAtiva !== 'boolean') {
    throw erro(400, 'Condições da assinatura Sandbox inválidas.');
  }
  // Criar a assinatura pode gerar uma fatura de imediato, ainda que o vencimento seja futuro.
  if (hoje < fimTeste || cortesiaAtiva) throw erro(409, 'Assinatura Sandbox indisponível durante o teste ou a cortesia.');
  const vencimento = [hoje, fimTeste, proximoVencimento].sort().at(-1);
  return {
    customer: cliente, billingType: meio, nextDueDate: vencimento, value: mensalidadeCentavos / 100,
    cycle: 'MONTHLY', description: 'Assinatura WC Fit — Sandbox',
    externalReference: referencia(namespace, 'assinatura', academiaId, geracao),
    ...(meio === 'PIX' || meio === 'UNDEFINED' ? { pixAutomaticAuthorizationMode: 'DISABLED' } : {}),
  };
}

function centavos(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) return null;
  const resultado = Math.round(valor * 100);
  return Number.isSafeInteger(resultado) ? resultado : null;
}

function linkFatura(valor) {
  try {
    const url = new URL(valor);
    if (url.origin === 'https://sandbox.asaas.com' && !url.username && !url.password &&
        /^\/i\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) return url.href;
  } catch {
    // A consulta continua disponível sem link.
  }
  return null;
}

function projetarCobranca(item, { cliente, assinatura }) {
  if (item?.customer !== cliente || item.subscription !== assinatura) {
    throw erro(502, 'Cobrança Sandbox fora do vínculo esperado.');
  }
  const status = item.deleted === true ? 'DELETED' :
    (typeof item.status === 'string' && /^[A-Z_]{3,50}$/.test(item.status) ? item.status : 'DESCONHECIDO');
  const estornos = Array.isArray(item.refunds) ? item.refunds.filter((x) => x?.status === 'DONE') : [];
  const valoresEstornados = estornos.map((x) => centavos(x.value));
  const soma = valoresEstornados.reduce((total, valor) => total + valor, 0);
  const valor = centavos(item.value);
  return {
    id: validarId(item.id, 'pay'), status,
    vencimento: validarDataYMD(item.dueDate) ? item.dueDate : null,
    recebido_em: validarDataYMD(item.paymentDate) ? item.paymentDate : null,
    valor_centavos: valor,
    estornado_centavos: valoresEstornados.includes(null) || !Number.isSafeInteger(soma) ||
      (!estornos.length && ['REFUNDED','PARTIALLY_REFUNDED'].includes(status)) ? null : soma,
    meio: meios.includes(item.billingType) ? item.billingType : null,
    fatura_url: linkFatura(item.invoiceUrl),
  };
}

function autenticarWebhook(recebido, env = process.env) {
  const esperado = env.ASAAS_SANDBOX_WEBHOOK_TOKEN;
  if (env.ASAAS_SANDBOX_ATIVO !== 'true' || !/^[!-~]{32,255}$/.test(esperado || '') ||
      esperado.startsWith('$aact_') || typeof recebido !== 'string' || recebido.length > 255) return false;
  const hash = (valor) => createHash('sha256').update(valor).digest();
  return timingSafeEqual(hash(esperado), hash(recebido));
}

function metadadosWebhook(corpo) {
  if (typeof corpo?.id !== 'string' || !/^evt_[a-zA-Z0-9_&-]{1,160}$/.test(corpo.id) ||
      typeof corpo.event !== 'string' || !/^[A-Z_]{3,70}$/.test(corpo.event)) {
    throw erro(400, 'Evento Asaas inválido.');
  }
  if (corpo.event === 'CHECKOUT_PAID') {
    const checkoutId = corpo.checkout?.id;
    if (typeof checkoutId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(checkoutId)) {
      throw erro(400,'Checkout do evento Asaas inválido.');
    }
    return { id:corpo.id, evento:corpo.event, checkoutId };
  }
  if (corpo.event === 'SUBSCRIPTION_DELETED') {
    if (!idValido(corpo.subscription?.id, 'sub')) throw erro(400, 'Assinatura do evento Asaas inválida.');
    return { id: corpo.id, evento: corpo.event, assinaturaId: corpo.subscription.id };
  }
  if (!corpo.event.startsWith('PAYMENT_')) return null;
  if (!idValido(corpo.payment?.id, 'pay')) throw erro(400, 'Cobrança do evento Asaas inválida.');
  return { id: corpo.id, evento: corpo.event, cobrancaId: corpo.payment.id };
}

function criarApi({ env = process.env, transporte = fetch } = {}) {
  const { chave, namespace } = configuracao(env);
  async function requisitar(caminho, { filtro, dados, metodo = dados ? 'POST' : 'GET' } = {}) {
    const url = base + caminho + (filtro ? '?' + new URLSearchParams(filtro) : '');
    let resposta;
    try {
      resposta = await transporte(url, {
        method: metodo, redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'WC-Fit-Sandbox', access_token: chave,
          ...(dados && { 'Content-Type': 'application/json' }) },
        ...(dados && { body: JSON.stringify(dados) }),
      });
    } catch {
      throw erro(502, 'Não foi possível confirmar a resposta do Asaas Sandbox.', { incerto: Boolean(dados) });
    }
    if (!resposta.ok) {
      await resposta.body?.cancel().catch(() => {});
      throw erro(502, 'O Asaas Sandbox não confirmou a operação.', {
        externo: resposta.status,
        incerto: Boolean(dados) && (resposta.status >= 500 || [408,409,425,429].includes(resposta.status)),
      });
    }
    try {
      return await resposta.json();
    } catch {
      throw erro(502, 'Resposta inválida do Asaas Sandbox.', { incerto: Boolean(dados) });
    }
  }

  async function consultarVinculo(tipo, academiaId, cliente, geracao) {
    const caminho = tipo === 'cliente' ? '/customers' : '/subscriptions';
    const externalReference = referencia(namespace, tipo, academiaId, geracao);
    const filtro = { externalReference, limit: 2 };
    if (tipo === 'assinatura') {
      filtro.customer = validarId(cliente, 'cus');
      filtro.includeDeleted = true;
    }
    const resposta = await requisitar(caminho, { filtro });
    const registros = resposta?.data;
    if (!Array.isArray(registros) || registros.length > 1 || resposta.hasMore ||
        registros.some((x) => x?.externalReference !== externalReference ||
          (tipo === 'assinatura' && x.customer !== cliente))) {
      throw erro(409, 'Vínculo ambíguo no Asaas Sandbox.');
    }
    if (!registros.length) return null;
    return { id: validarId(registros[0].id, tipo === 'cliente' ? 'cus' : 'sub'),
      ...(tipo === 'assinatura' && { removida: registros[0].deleted === true,
        mensalidadeCentavos: centavos(registros[0].value) }) };
  }

  async function criar(caminho, dados, prefixo) {
    const retorno = await requisitar(caminho, { dados });
    if (retorno?.externalReference !== dados.externalReference ||
        (dados.customer && (retorno.customer !== dados.customer || centavos(retorno.value) !== centavos(dados.value))) ||
        !idValido(retorno?.id, prefixo)) {
      throw erro(502, 'Criação Sandbox sem vínculo confirmado.', { incerto: true });
    }
    return { id: retorno.id };
  }

  const validarCheckout = (id) => {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
      throw erro(502,'Identificador de Checkout Sandbox inválido.', { incerto: true });
    }
    return id;
  };

  return {
    namespace,
    consultarCliente: (academiaId) => consultarVinculo('cliente', academiaId),
    consultarAssinatura: (academiaId, cliente, geracao) => consultarVinculo('assinatura', academiaId, cliente, geracao),
    criarCliente: (dados) => criar('/customers', dadosCliente(dados, namespace), 'cus'),
    criarAssinatura: (dados, hoje) => criar('/subscriptions', dadosAssinatura(dados, namespace, hoje), 'sub'),
    async criarCheckoutCartao({ cliente, referencia, retorno, preco, data }) {
      const resposta = await requisitar('/checkouts', { dados: {
        customer: validarId(cliente,'cus'), externalReference: referencia,
        billingTypes:['CREDIT_CARD'], chargeTypes:['RECURRENT'], minutesToExpire:30,
        callback:{ successUrl:retorno, cancelUrl:retorno, expiredUrl:retorno },
        items:[{ name:'WC Fit mensal — Sandbox', quantity:1, value:preco/100 }],
        subscription:{ cycle:'MONTHLY', nextDueDate:data + ' 00:00:00' },
      } });
      return validarCheckout(resposta?.id);
    },
    async cancelarCheckout(id) {
      const resposta = await requisitar('/checkouts/' + validarCheckout(id) + '/cancel', { metodo:'POST' });
      return resposta?.id === id && ['CANCELED','CANCELLED','EXPIRED'].includes(resposta.status);
    },
    async localizarAssinaturaCheckout(id, cliente, preco) {
      const resposta = await requisitar('/payments', { filtro:{ checkoutSession:validarCheckout(id), customer:validarId(cliente,'cus'), limit:20 } });
      if (!Array.isArray(resposta?.data) || resposta.hasMore || resposta.data.some((p) =>
        p.customer !== cliente || p.checkoutSession !== id || p.billingType !== 'CREDIT_CARD' || centavos(p.value) !== preco)) {
        throw erro(409,'Pagamentos do Checkout ainda não conciliados.');
      }
      const ids = [...new Set(resposta.data.map((p) => validarId(p.subscription,'sub')))];
      if (ids.length > 1) throw erro(409,'Checkout com vínculo de recorrência ambíguo.');
      return ids[0] || null;
    },
    async localizarCartaoAgendado(cliente, referencia, preco) {
      const resposta = await requisitar('/subscriptions', { filtro:{ customer:validarId(cliente,'cus'), externalReference:referencia, limit:2 } });
      if (!Array.isArray(resposta?.data) || resposta.hasMore || resposta.data.length > 1 ||
          resposta.data.some((s) => s.externalReference !== referencia || s.customer !== cliente ||
            s.billingType !== 'CREDIT_CARD' || centavos(s.value) !== preco)) {
        throw erro(409,'Assinatura agendada ainda não conciliada.');
      }
      return resposta.data.length ? validarId(resposta.data[0].id,'sub') : null;
    },
    async consultarAssinaturaPorId(id, cliente, preco) {
      let retorno;
      try { retorno = await requisitar('/subscriptions/' + validarId(id,'sub')); }
      catch (falha) { if (falha.externo === 404) return { id, removida:true }; throw falha; }
      if (retorno?.id !== id || retorno.customer !== cliente || centavos(retorno.value) !== preco) {
        throw erro(409,'Vínculo da assinatura Sandbox incompatível.');
      }
      return { id, removida:retorno.deleted === true };
    },
    async removerAssinatura(id) {
      const uri = '/subscriptions/' + validarId(id, 'sub');
      try {
        const retorno = await requisitar(uri, { metodo: 'DELETE' });
        return retorno?.id === id && retorno.deleted === true;
      } catch (falha) {
        if (falha.externo === 404) return true;
        throw falha;
      }
    },
    async listarCobrancas(cliente, assinatura, offset = 0, intervalo) {
      validarId(cliente, 'cus');
      validarId(assinatura, 'sub');
      if (!Number.isSafeInteger(offset) || offset < 0) throw erro(400, 'Página Sandbox inválida.');
      const filtro = { customer: cliente, subscription: assinatura, offset, limit: 20 };
      if (intervalo) {
        filtro['dueDate[ge]'] = intervalo.inicio;
        filtro['dueDate[le]'] = intervalo.fim;
      }
      const resposta = await requisitar('/payments', { filtro });
      if (!Array.isArray(resposta?.data)) throw erro(502, 'Consulta de cobranças Sandbox inválida.');
      return { cobrancas: resposta.data.map((item) => projetarCobranca(item, { cliente, assinatura })), temMais: resposta.hasMore === true };
    },
    async consultarCobranca(id, vinculo) {
      const resposta = await requisitar('/payments/' + validarId(id, 'pay'));
      if (resposta?.id !== id) throw erro(502, 'Resposta incompatível com a cobrança Sandbox.');
      if (!vinculo && !resposta.subscription) return null;
      const dados = vinculo || { cliente: validarId(resposta.customer, 'cus'),
        assinatura: validarId(resposta.subscription, 'sub') };
      return { ...projetarCobranca(resposta, dados), ...(!vinculo && dados) };
    },
  };
}

module.exports = { criarApi, dadosAssinatura, autenticarWebhook, metadadosWebhook };
