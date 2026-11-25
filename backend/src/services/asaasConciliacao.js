const { consulta, transacao } = require('../models/SuperAdmin');
const { criarApi } = require('./asaasSandbox');
const comercial = require('./asaasComercial');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');

const erro = (status,mensagem) => Object.assign(new Error(mensagem),{ status });

async function enfileirar(evento, namespace) {
  await consulta(`
    INSERT INTO wcfit_asaas_sandbox_eventos (namespace,evento_id,tipo,recurso_id)
    VALUES ($1,$2,$3,$4) ON CONFLICT (namespace,evento_id) DO NOTHING`,
  [namespace,evento.id,evento.evento,evento.cobrancaId || evento.assinaturaId || evento.checkoutId]);
}

async function gravarCobranca(client, op, cobranca) {
  const { rowCount } = await client.query(`
    INSERT INTO wcfit_asaas_sandbox_cobrancas
      (externo_id,academia_id,assinatura_id,vencimento,recebido_em,status,valor_centavos,estornado_centavos,meio,recebido_gateway)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$6='RECEIVED')
    ON CONFLICT (externo_id) DO UPDATE SET vencimento=EXCLUDED.vencimento,
      recebido_em=coalesce(EXCLUDED.recebido_em,wcfit_asaas_sandbox_cobrancas.recebido_em),
      recebido_gateway=EXCLUDED.recebido_gateway OR (EXCLUDED.status IN ('PARTIALLY_REFUNDED','REFUND_IN_PROGRESS')
        AND wcfit_asaas_sandbox_cobrancas.recebido_gateway),
      status=EXCLUDED.status, valor_centavos=EXCLUDED.valor_centavos, estornado_centavos=EXCLUDED.estornado_centavos,
      meio=EXCLUDED.meio, atualizado_em=clock_timestamp()
    WHERE wcfit_asaas_sandbox_cobrancas.assinatura_id=EXCLUDED.assinatura_id
      AND wcfit_asaas_sandbox_cobrancas.academia_id=EXCLUDED.academia_id`,
  [cobranca.id,op.academia_id,op.id,cobranca.vencimento,cobranca.recebido_em,cobranca.status,
    cobranca.valor_centavos,cobranca.estornado_centavos,cobranca.meio]);
  if (!rowCount) throw erro(409,'A cobrança Sandbox já pertence a outro vínculo.');
}

async function atualizarCobranca(client, api, id, tipo, esperado) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['wcfit:asaas-sandbox:pagamento:'+id]);
  let cobranca;
  try {
    cobranca = await api.consultarCobranca(id);
  } catch (falha) {
    if (falha.externo !== 404 || tipo !== 'PAYMENT_DELETED') throw falha;
    await client.query(`
      UPDATE wcfit_asaas_sandbox_cobrancas p SET status='DELETED',atualizado_em=clock_timestamp()
      FROM wcfit_asaas_sandbox_operacoes o
      WHERE p.externo_id=$1 AND o.id=p.assinatura_id AND o.namespace=$2 AND p.status IN ('PENDING','OVERDUE')`,
    [id,api.namespace]);
    return true;
  }
  if (!cobranca) return true;
  const { rows: [op] } = await client.query(`
    SELECT id,academia_id,cliente_id FROM wcfit_asaas_sandbox_operacoes
    WHERE externo_id=$1 AND namespace=$2 AND tipo='assinatura'`,[cobranca.assinatura,api.namespace]);
  if (esperado && op?.id !== esperado.id) throw erro(409,'A cobrança Sandbox pertence a outra assinatura.');
  if (!op) {
    const { rowCount } = await client.query(`
      SELECT 1 FROM wcfit_asaas_sandbox_operacoes WHERE namespace=$1 AND tipo='assinatura'
        AND cliente_id=$2 AND estado IN ('enviando','incerta') LIMIT 1`, [api.namespace,cobranca.cliente]);
    return !rowCount;
  }
  if (op.cliente_id !== cobranca.cliente) throw erro(409,'A cobrança Sandbox pertence a outro cliente.');
  await gravarCobranca(client,op,cobranca);
  return true;
}

async function atualizarCancelamento(client, api, id) {
  const { rows: [op] } = await client.query(`
    SELECT id,academia_id,cliente_id,estado,valor_centavos FROM wcfit_asaas_sandbox_operacoes
    WHERE externo_id=$1 AND namespace=$2 AND tipo='assinatura' FOR UPDATE`,[id,api.namespace]);
  if (!op || op.estado === 'cancelada') return true;
  const estado = await api.consultarAssinaturaPorId(id,op.cliente_id,op.valor_centavos);
  if (!estado?.removida || estado.id !== id) return false;
  await client.query("UPDATE wcfit_asaas_sandbox_operacoes SET estado='cancelada',atualizado_em=clock_timestamp() WHERE id=$1",[op.id]);
  return true;
}

async function processarUm(api) {
  return transacao(async (client) => {
    const { rows: [evento] } = await client.query(`
      SELECT evento_id,tipo,recurso_id FROM wcfit_asaas_sandbox_eventos
      WHERE namespace=$1 AND processado_em IS NULL AND tentativas < 12 AND tentar_em <= clock_timestamp()
      ORDER BY tentar_em,criado_em LIMIT 1 FOR UPDATE SKIP LOCKED`,[api.namespace]);
    if (!evento) return false;
    await client.query('SAVEPOINT aplicar_evento_asaas');
    let concluido = false;
    try {
      if (evento.tipo === 'CHECKOUT_PAID') {
        concluido = await require('./autogestaoComercial').conciliarCheckoutNotificado(evento.recurso_id,api);
      } else {
        concluido = evento.tipo === 'SUBSCRIPTION_DELETED'
          ? await atualizarCancelamento(client,api,evento.recurso_id)
          : await atualizarCobranca(client,api,evento.recurso_id,evento.tipo);
      }
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT aplicar_evento_asaas');
    }
    if (concluido) {
      await client.query(`
        UPDATE wcfit_asaas_sandbox_eventos SET processado_em=clock_timestamp() WHERE namespace=$1 AND evento_id=$2`,
      [api.namespace,evento.evento_id]);
    } else {
      await client.query(`
        UPDATE wcfit_asaas_sandbox_eventos SET tentativas=tentativas+1,
          tentar_em=clock_timestamp()+make_interval(secs => least(3600,5*(1 << tentativas)))
        WHERE namespace=$1 AND evento_id=$2`, [api.namespace,evento.evento_id]);
    }
    return true;
  });
}

function iniciarFila() {
  if (process.env.ASAAS_SANDBOX_ATIVO !== 'true') return;
  let trabalhando = false;
  let proximoPix = 0;
  const timer = setInterval(async () => {
    if (trabalhando) return;
    trabalhando = true;
    try {
      const api = criarApi();
      if (await comercial.disponivel()) await processarUm(api);
      if (Date.now() >= proximoPix) {
        proximoPix = Date.now() + 30000;
        await require('./autogestaoComercial').processarPixAgendado(api);
      }
    } catch {
      // Mantém a fila para a próxima tentativa, sem registrar credenciais ou payload.
    } finally {
      trabalhando = false;
    }
  }, 2000);
  timer.unref();
}

async function consultarCobrancas(academia, pagina, assinaturaId, atualizar = false) {
  await comercial.exigirSchema();
  const api = criarApi();
  const vinculos = await comercial.vinculos(academia,api.namespace);
  if (!vinculos.length) throw erro(404,'Academia sem assinatura vinculada no Asaas Sandbox.');
  const vinculo = assinaturaId ? vinculos.find((item) => item.id === assinaturaId) : vinculos[0];
  if (!vinculo) throw erro(404,'Vínculo Sandbox não encontrado para a academia.');
  const resultado = await api.listarCobrancas(vinculo.cliente_id,vinculo.externo_id,(pagina-1)*20);
  if (atualizar) {
    for (let indice = 0; indice < resultado.cobrancas.length; indice += 4) {
      const lote = resultado.cobrancas.slice(indice,indice+4);
      await Promise.all(lote.map((item) =>
        transacao((client) => atualizarCobranca(client,api,item.id,'CONSULTA',vinculo))));
    }
  }
  const { rows } = await consulta(`
    SELECT to_char(competencia,'YYYY-MM') AS mes FROM wcfit_recebimentos WHERE academia_id=$1`,[academia]);
  const mesesManuais = new Set(rows.map((row) => row.mes));
  return { pagina, temMais: resultado.temMais, assinatura_id:vinculo.id,
    assinaturas:vinculos.map(({ id,estado }) => ({ id,estado })),
    cobrancas:resultado.cobrancas.map((item) => ({
      ...item, recebimento_manual_mes: mesesManuais.has(item.vencimento?.slice(0,7)),
    })),
  };
}

async function indicadores() {
  if (process.env.ASAAS_SANDBOX_ATIVO !== 'true' || !await comercial.disponivel()) return null;
  let api;
  try { api = criarApi(); } catch { return null; }
  const { rows: [dados] } = await consulta(`
    SELECT count(*) FILTER (WHERE p.status IN ('PENDING','OVERDUE') AND o.estado<>'cancelada') AS em_aberto,
      count(*) FILTER (WHERE p.status='OVERDUE' AND o.estado<>'cancelada') AS vencidas,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM wcfit_recebimentos r WHERE r.academia_id=p.academia_id
          AND date_trunc('month',r.competencia::timestamp)=date_trunc('month',p.vencimento::timestamp))) AS com_manual,
      coalesce(sum(greatest(p.valor_centavos-p.estornado_centavos,0)) FILTER (
        WHERE p.recebido_gateway AND p.valor_centavos IS NOT NULL AND p.estornado_centavos IS NOT NULL
        AND p.recebido_em >= date_trunc('month',$1::date) AND p.recebido_em <= $1::date),0) AS recebido_mes_centavos,
      coalesce(sum(p.estornado_centavos),0) AS estornado_centavos,
      (SELECT count(*) FROM wcfit_asaas_sandbox_operacoes WHERE namespace=$2 AND tipo='assinatura'
        AND estado='vinculada') AS recorrencias,
      (SELECT count(*) FROM wcfit_asaas_sandbox_eventos WHERE namespace=$2 AND processado_em IS NULL) AS eventos_pendentes
    FROM wcfit_asaas_sandbox_cobrancas p JOIN wcfit_asaas_sandbox_operacoes o ON o.id=p.assinatura_id
    WHERE o.namespace=$2`,[getDataHojeFortaleza(),api.namespace]);
  return Object.fromEntries(Object.entries(dados).map(([campo,valor])=>[campo,Number(valor)]));
}

module.exports = { gravarCobranca, enfileirar, iniciarFila, processarUm, consultarCobrancas, indicadores };
