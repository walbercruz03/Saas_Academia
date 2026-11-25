const assert = require('node:assert/strict');
const test = require('node:test');
const { criarApi, dadosAssinatura, autenticarWebhook, metadadosWebhook } = require('./src/services/asaasSandbox');

const env = {
  ASAAS_SANDBOX_ATIVO: 'true',
  ASAAS_SANDBOX_API_KEY: '$aact_hmlg_teste_ficticio',
  ASAAS_SANDBOX_NAMESPACE: 'teste-local',
  ASAAS_SANDBOX_WEBHOOK_TOKEN: 'sandbox-token-de-teste-nao-utilizar',
};
const cliente = 'cus_sintetico';
const assinatura = 'sub_sintetica';
const vinculo = { cliente, assinatura };
const dia = '2026-11-24';

test('o transporte exige configuração e recusa uma chave de produção', () => {
  assert.throws(() => criarApi({ env: {} }), { status: 503 });
  assert.throws(() => criarApi({ env: { ...env, ASAAS_SANDBOX_API_KEY: '$aact_prod_ficticio' } }), { status: 503 });
});

test('cliente sintético usa Sandbox, referência da academia e notificações desativadas', async () => {
  const api = criarApi({ env, transporte: async (url, opcoes) => {
    assert.equal(url, 'https://api-sandbox.asaas.com/v3/customers');
    assert.equal(opcoes.headers.access_token, env.ASAAS_SANDBOX_API_KEY);
    assert.equal(opcoes.method, 'POST');
    assert.equal(opcoes.redirect, 'error');
    const dados = JSON.parse(opcoes.body);
    assert.deepEqual(dados, {
      name: 'Academia sintética', cpfCnpj: '52998224725', notificationDisabled: true,
      externalReference: 'wcfit-teste-local-cliente-31',
    });
    return Response.json({ ...dados, id: cliente });
  } });
  assert.deepEqual(await api.criarCliente({
    nome: 'Academia sintética', documento: '529.982.247-25', tipo: 'pessoa_fisica', academiaId: 31,
  }), { id: cliente });
});

test('assinatura mantém o contrato, recusa trial e cortesia e usa fatura sem dados de cartão', () => {
  const dados = { academiaId: 31, cliente, mensalidadeCentavos: 7999, fimTeste: dia,
    proximoVencimento: '2026-11-20', cortesiaAtiva: false };
  assert.throws(() => dadosAssinatura(dados, 'teste-local', '2026-11-23'), { status: 409 });
  assert.throws(() => dadosAssinatura({ ...dados, cortesiaAtiva: true }, 'teste-local', dia), { status: 409 });
  for (const meio of ['PIX','BOLETO','CREDIT_CARD','UNDEFINED']) {
    const requisicao = dadosAssinatura({ ...dados, meio }, 'teste-local', dia);
    assert.equal(requisicao.nextDueDate, dia);
    assert.equal(requisicao.value, 79.99);
    assert.equal(requisicao.billingType, meio);
    assert.equal(requisicao.cycle, 'MONTHLY');
    assert.ok(!Object.hasOwn(requisicao,'creditCard') && !Object.hasOwn(requisicao,'creditCardToken'));
  }
});

test('criação incerta não é reenviada automaticamente e vínculo ambíguo é recusado', async () => {
  let envios = 0;
  const api = criarApi({ env, transporte: async (_url, opcoes) => {
    if (opcoes.method === 'POST') {
      envios += 1;
      throw new Error('timeout simulado');
    }
    return Response.json({ data: [{ id: cliente }, { id: 'cus_duplicado' }] });
  } });
  await assert.rejects(api.criarCliente({
    nome: 'Academia sintética', documento: '52998224725', tipo: 'pessoa_fisica', academiaId: 31,
  }), { incerto: true });
  assert.equal(envios, 1);
  await assert.rejects(api.consultarCliente(31), { status: 409 });
});

test('consulta concorrente não aceita cobranças de outro vínculo nem links externos', async () => {
  const fake = { customer: cliente, subscription: assinatura, id: 'pay_sintetico',
    status: 'PARTIALLY_REFUNDED', value: 79.99, billingType: 'CREDIT_CARD',
    dueDate: dia, paymentDate: dia, invoiceUrl: 'https://sandbox.asaas.com/i/123',
    refunds: [{ status: 'DONE', value: 20 }, { status: 'PENDING', value: 10 }, { status: 'CANCELLED', value: 5 }],
    creditCard: { creditCardNumber: 'campo-ficticio-que-nao-deve-ser-projetado' },
  };
  const api = criarApi({ env, transporte: async (url) => {
    const destino = new URL(url);
    assert.equal(destino.searchParams.get('subscription'), assinatura);
    assert.equal(destino.searchParams.get('customer'), cliente);
    const offset = destino.searchParams.get('offset');
    if (offset === '20') return Response.json({ data: [{ ...fake, customer: 'cus_outra_academia' }] });
    return Response.json({ data: [offset === '40' ? { ...fake, invoiceUrl: 'https://www.asaas.com/i/123' } : fake] });
  } });
  const [valida, invalidada, link] = await Promise.allSettled([
    api.listarCobrancas(cliente,assinatura), api.listarCobrancas(cliente,assinatura,20), api.listarCobrancas(cliente,assinatura,40),
  ]);
  const cobranca = valida.value.cobrancas[0];
  assert.equal(cobranca.estornado_centavos, 2000);
  assert.equal(cobranca.fatura_url, fake.invoiceUrl);
  assert.equal(cobranca.valor_centavos, 7999);
  assert.ok(!('creditCard' in cobranca));
  assert.equal(invalidada.reason.status, 502);
  assert.equal(link.value.cobrancas[0].fatura_url, null);
});

test('webhook exige token e trata o evento atrasado como referência para consultar a cobrança', async () => {
  assert.equal(autenticarWebhook('token incorreto', env), false);
  assert.equal(autenticarWebhook(env.ASAAS_SANDBOX_WEBHOOK_TOKEN, env), true);
  assert.equal(autenticarWebhook(env.ASAAS_SANDBOX_WEBHOOK_TOKEN, { ...env, ASAAS_SANDBOX_ATIVO: 'false' }), false);
  const evento = metadadosWebhook({ id: 'evt_teste&19', event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_sintetico', status: 'RECEIVED' } });
  assert.deepEqual(evento, { id: 'evt_teste&19', evento: 'PAYMENT_RECEIVED', cobrancaId: 'pay_sintetico' });
  assert.throws(() => metadadosWebhook({ id: 'evt_teste', event: 'PAYMENT_UPDATED', payment: { id: '../x' } }), { status: 400 });
  const api = criarApi({ env, transporte: async () => Response.json({
    customer: cliente, subscription: assinatura, id: evento.cobrancaId, status: 'REFUNDED',
    value: 79.99, refunds: [{ status: 'DONE', value: 79.99 }],
  }) });
  const atual = await api.consultarCobranca(evento.cobrancaId, vinculo);
  assert.equal(atual.status, 'REFUNDED');
  assert.equal(atual.estornado_centavos, 7999);
});
