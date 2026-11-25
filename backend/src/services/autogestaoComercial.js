const { randomUUID } = require('node:crypto');
const { consulta, transacao, auditar } = require('../models/SuperAdmin');
const { comAssinatura } = require('../models/ComercialWcFit');
const { criarApi } = require('./asaasSandbox');
const asaas = require('./asaasComercial');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');

const { getDataHojeFortaleza } = require('../utils/datasFortaleza');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });

async function disponivel(executor = { query: consulta }) {
  return (await executor.query("SELECT to_regclass('public.wcfit_autogestao') IS NOT NULL AS pronta")).rows[0].pronta;
}

async function estado(academiaId) {
  if (!await disponivel()) return null;
  const { rows: [linha] } = await consulta(`SELECT meio, consentido_em, cancelamento_solicitado_em,
      cancelado_em, acesso_ate::text, checkout_incerto
    FROM wcfit_autogestao WHERE academia_id=$1`, [academiaId]);
  return linha || {};
}

function retornoCheckout() {
  try {
    const url = new URL(process.env.ASAAS_SANDBOX_RETORNO);
    if (url.protocol === 'https:' && !url.username && !url.password &&
        url.pathname === '/configuracoes/assinatura' && !url.search && !url.hash) return url.href;
  } catch {}
  throw erro(503,'Defina a URL HTTPS de retorno do Checkout Sandbox.');
}

async function clienteVinculado(client, id, api) {
  const { rows: [cliente] } = await client.query(`
    SELECT externo_id FROM wcfit_asaas_sandbox_operacoes
    WHERE academia_id=$1 AND namespace=$2 AND tipo='cliente' AND estado='vinculada'`, [id,api.namespace]);
  return cliente?.externo_id;
}

async function conciliarCheckout(ator, id, api, checkout) {
  if (!checkout.checkout_id) return null;
  const cliente = await clienteVinculado({ query: consulta },id,api);
  const externo = await api.localizarAssinaturaCheckout(checkout.checkout_id,cliente,checkout.preco_centavos)
    || await api.localizarCartaoAgendado?.(cliente,checkout.checkout_referencia,checkout.preco_centavos);
  if (!externo) return null;
  return comAssinatura(ator,id,async (client) => {
    const { rows: [atual] } = await client.query('SELECT checkout_id FROM wcfit_autogestao WHERE academia_id=$1',[id]);
    if (atual?.checkout_id !== checkout.checkout_id) throw erro(409,'O Checkout foi alterado durante a conciliação.');
    const { rows: [op] } = await client.query('SELECT id,academia_id,namespace FROM wcfit_asaas_sandbox_operacoes WHERE externo_id=$1',[externo]);
    if (op) {
      if (op.academia_id !== id || op.namespace !== api.namespace) throw erro(409,'Vínculo de Checkout incompatível.');
      return op.id;
    }
    const { rows: [novo] } = await client.query(`
      INSERT INTO wcfit_asaas_sandbox_operacoes(academia_id,namespace,tipo,estado,externo_id,cliente_id,
        vencimento_inicial,valor_centavos,meio)
      SELECT $1,$2,'assinatura','vinculada',$3,$4,greatest(s.fim_teste,s.proximo_vencimento),$5,'CREDIT_CARD'
      FROM wcfit_assinaturas s WHERE s.academia_id=$1 RETURNING id`, [id,api.namespace,externo,cliente,checkout.preco_centavos]);
    return novo.id;
  });
}

async function contratar(ator, id, { meio, preco, documento, trocar }, api = criarApi()) {
  if (documento && !['pessoa_fisica','empresa'].some((tipo) => normalizarDocumento(documento,tipo))) {
    throw erro(400,'Informe um documento fictício válido para o Sandbox.');
  }
  const retorno = meio === 'CREDIT_CARD' ? retornoCheckout() : null;
  if (trocar === true) await prepararTroca(ator,id,meio,preco,api);
  const dados = await comAssinatura(ator,id,async (client,_dono,contrato,cortesia,hoje) => {
    if (!await disponivel(client)) throw erro(503,'A contratação requer a migration 016.');
    if (contrato.mensalidade_centavos !== preco) throw erro(409,'Confira o valor contratado.');
    if (cortesia) throw erro(409,'A academia possui cortesia vigente.');
    const { rows: [atual] } = await client.query('SELECT * FROM wcfit_autogestao WHERE academia_id=$1',[id]);
    if (atual?.cancelamento_solicitado_em) throw erro(409,'O contrato está em cancelamento ou foi encerrado.');
    if (atual?.meio && atual.meio !== meio) {
      const { rowCount } = await client.query(`SELECT 1 FROM wcfit_asaas_sandbox_operacoes
        WHERE academia_id=$1 AND tipo='assinatura' AND estado IN ('enviando','incerta','vinculada','cancelando')`,[id]);
      if (rowCount || atual.checkout_referencia) throw erro(409,'Encerre a recorrência antes de trocar a forma de pagamento.');
    }
    await client.query(`
      INSERT INTO wcfit_autogestao(academia_id,consentido_em,consentido_por,preco_centavos,meio,autorizado_em,autorizado_por)
      VALUES($1,clock_timestamp(),$2,$3,$4,clock_timestamp(),$2)
      ON CONFLICT(academia_id) DO UPDATE SET consentido_em=coalesce(wcfit_autogestao.consentido_em,EXCLUDED.consentido_em),
        consentido_por=coalesce(wcfit_autogestao.consentido_por,EXCLUDED.consentido_por),
        preco_centavos=EXCLUDED.preco_centavos,meio=EXCLUDED.meio,
        autorizado_em=EXCLUDED.autorizado_em,autorizado_por=EXCLUDED.autorizado_por`, [id,ator.usuarioId,preco,meio]);
    return { adiado:hoje < contrato.primeiro_dia_cobravel,
      data:[hoje,contrato.primeiro_dia_cobravel,contrato.proximo_vencimento].sort().at(-1) };
  });
  if (dados.adiado && meio === 'PIX' && !documento && !await clienteVinculado({ query: consulta },id,api)) {
    return { estado:'trial' };
  }
  await asaas.provisionar(ator,id,'cliente',{ documento },api);
  if (meio === 'PIX') {
    if (getDataHojeFortaleza() < dados.data) return { estado:'agendada', primeiro_vencimento:dados.data };
    await asaas.provisionar(ator,id,'assinatura',{ meio },api);
    return { estado:'vinculada' };
  }
  const reserva = await comAssinatura(ator,id,async (client) => {
    const { rows: [atual] } = await client.query('SELECT * FROM wcfit_autogestao WHERE academia_id=$1',[id]);
    if (atual.meio !== 'CREDIT_CARD' || atual.cancelamento_solicitado_em || atual.checkout_incerto) throw erro(409,'Operação de Checkout em conciliação.');
    if (atual.checkout_id) return atual;
    const { rowCount } = await client.query(`
      SELECT 1 FROM wcfit_asaas_sandbox_operacoes WHERE academia_id=$1 AND tipo='assinatura'
        AND estado IN ('enviando','incerta','vinculada','cancelando')`, [id]);
    if (rowCount) throw erro(409,'Já existe uma recorrência Sandbox para esta academia.');
    const pago = await client.query(`
      SELECT 1 FROM wcfit_recebimentos WHERE academia_id=$1
        AND date_trunc('month',competencia::timestamp)=date_trunc('month',$2::date::timestamp)
      UNION ALL
      SELECT 1 FROM wcfit_asaas_sandbox_cobrancas WHERE academia_id=$1 AND status IN ('RECEIVED','CONFIRMED')
        AND date_trunc('month',vencimento::timestamp)=date_trunc('month',$2::date::timestamp)`,[id,dados.data]);
    if (pago.rowCount) throw erro(409,'Já existe pagamento para esta competência.');
    const referencia = 'wcfit-' + api.namespace + '-checkout-' + randomUUID();
    await client.query('UPDATE wcfit_autogestao SET checkout_incerto=true,checkout_referencia=$2 WHERE academia_id=$1',[id,referencia]);
    return { checkout_referencia:referencia, cliente:await clienteVinculado(client,id,api) };
  });
  let checkout = reserva.checkout_id;
  if (!checkout) {
    try {
      checkout = await api.criarCheckoutCartao({ cliente:reserva.cliente, referencia:reserva.checkout_referencia,
        retorno, preco, data:dados.data });
    } catch (falha) {
      if ([400,401,403,422].includes(falha.externo) && !falha.incerto) await consulta(`
        UPDATE wcfit_autogestao SET checkout_incerto=false,checkout_referencia=NULL WHERE academia_id=$1 AND checkout_referencia=$2`,
      [id,reserva.checkout_referencia]);
      throw falha;
    }
    await consulta('UPDATE wcfit_autogestao SET checkout_id=$2,checkout_incerto=false WHERE academia_id=$1 AND checkout_referencia=$3',
      [id,checkout,reserva.checkout_referencia]);
  } else {
    if (await conciliarCheckout(ator,id,api,reserva)) return { estado:'vinculada' };
    if (reserva.checkout_encerrado_em) throw erro(409,'Checkout encerrado. Cancele a operação antes de prosseguir.');
  }
  return { estado:'checkout', primeiro_vencimento:dados.data, link:'https://sandbox.asaas.com/checkoutSession/show?id=' + encodeURIComponent(checkout) };
}

async function cancelar(ator,id, criar = criarApi) {
  const atual = await comAssinatura(ator,id,async (client) => {
    if (!await disponivel(client)) throw erro(503,'O cancelamento requer a migration 016.');
    await client.query(`INSERT INTO wcfit_autogestao(academia_id,cancelamento_solicitado_em)
      VALUES($1,clock_timestamp()) ON CONFLICT(academia_id) DO UPDATE
      SET cancelamento_solicitado_em=coalesce(wcfit_autogestao.cancelamento_solicitado_em,EXCLUDED.cancelamento_solicitado_em)`, [id]);
    return (await client.query('SELECT * FROM wcfit_autogestao WHERE academia_id=$1',[id])).rows[0];
  });
  if (atual.cancelado_em) return estado(id);
  await encerrarVinculos(ator,id,atual,criar);
  return comAssinatura(ator,id,async (client,_dono,contrato,_cortesia,hoje) => {
    const { rows: [linha] } = await client.query(`
      UPDATE wcfit_autogestao a SET cancelado_em=coalesce(a.cancelado_em,clock_timestamp()),
        acesso_ate=coalesce(a.acesso_ate,greatest($2::date,$3::date,
          (SELECT max((competencia+interval '1 month')::date) FROM wcfit_recebimentos WHERE academia_id=$1),
          (SELECT max((vencimento+interval '1 month')::date) FROM wcfit_asaas_sandbox_cobrancas
            WHERE academia_id=$1 AND status IN ('RECEIVED','CONFIRMED') AND coalesce(estornado_centavos,0)=0)))
      FROM wcfit_assinaturas s WHERE a.academia_id=$1 AND s.academia_id=$1
      RETURNING a.cancelado_em,a.acesso_ate::text`, [id,hoje,contrato.primeiro_dia_cobravel]);
    return linha;
  });
}

async function encerrarVinculos(ator,id,atual,criar) {
  if (atual.checkout_incerto) throw erro(409,'A criação do Checkout ainda precisa ser conciliada.');
  if (atual.checkout_id) {
    const api = criar();
    if (!await conciliarCheckout(ator,id,api,atual) && !atual.checkout_encerrado_em && !await api.cancelarCheckout(atual.checkout_id)) {
      throw erro(409,'O Asaas ainda não confirmou o encerramento do Checkout.');
    }
  }
  const { rows: [vinculo] } = await consulta(`
    SELECT EXISTS(SELECT FROM wcfit_asaas_sandbox_operacoes WHERE academia_id=$1 AND tipo='assinatura'
      AND estado IN ('enviando','incerta','vinculada','cancelando')) AS vinculado,
      EXISTS(SELECT FROM wcfit_assinaturas WHERE academia_id=$1 AND provedor IS NOT NULL) AS legado`, [id]);
  if (vinculo.legado) throw erro(409,'Concilie o vínculo legado antes de prosseguir.');
  if (vinculo.vinculado) await asaas.cancelar(ator,id,criar());
  const { rows: vinculos } = await consulta(`
    SELECT id,namespace,externo_id,cliente_id,academia_id FROM wcfit_asaas_sandbox_operacoes
    WHERE academia_id=$1 AND tipo='assinatura' AND estado='cancelada'`, [id]);
  if (vinculos.length) {
    const api = criar();
    const { gravarCobranca } = require('./asaasConciliacao');
    for (const op of vinculos) {
      if (op.namespace !== api.namespace) throw erro(409,'Existe histórico Sandbox em outra configuração.');
      for (let pagina=0; ; pagina++) {
        if (pagina >= 100) throw erro(409,'Conciliação do histórico de cobranças pendente.');
        const { cobrancas, temMais } = await api.listarCobrancas(op.cliente_id,op.externo_id,pagina*20);
        await transacao(async (client) => {
          for (const cobranca of cobrancas) await gravarCobranca(client,op,cobranca);
        });
        if (!temMais) break;
      }
    }
  }
}

async function prepararTroca(ator,id,meio,preco,api) {
  const anterior = await comAssinatura(ator,id,async (client,_dono,contrato,cortesia) => {
    if (!await disponivel(client)) throw erro(503,'A troca requer a migration 016.');
    if (preco !== contrato.mensalidade_centavos || cortesia) throw erro(409,'Confira as condições do contrato.');
    const { rows: [linha] } = await client.query('SELECT * FROM wcfit_autogestao WHERE academia_id=$1',[id]);
    if (linha?.cancelamento_solicitado_em) throw erro(409,'O contrato está em cancelamento ou foi encerrado.');
    return linha;
  });
  if (!anterior?.meio || anterior.meio === meio) return;
  await encerrarVinculos(ator,id,anterior,() => api);
  await comAssinatura(ator,id,async (client) => {
    const { rows:[linha] } = await client.query('SELECT * FROM wcfit_autogestao WHERE academia_id=$1',[id]);
    if (linha.cancelamento_solicitado_em || linha.checkout_incerto || linha.meio !== anterior.meio ||
        linha.checkout_id !== anterior.checkout_id || linha.checkout_referencia !== anterior.checkout_referencia ||
        String(linha.autorizado_em) !== String(anterior.autorizado_em)) {
      throw erro(409,'A recorrência mudou durante a troca.');
    }
    const viva = await client.query(`SELECT 1 FROM wcfit_asaas_sandbox_operacoes WHERE academia_id=$1 AND tipo='assinatura'
      AND estado IN ('enviando','incerta','vinculada','cancelando')`,[id]);
    if (viva.rowCount) throw erro(409,'A recorrência anterior ainda não está encerrada.');
    await client.query(`UPDATE wcfit_assinaturas s SET proximo_vencimento=greatest(s.proximo_vencimento,
      (SELECT max((vencimento+interval '1 month')::date) FROM wcfit_asaas_sandbox_cobrancas
        WHERE academia_id=$1 AND status IN ('RECEIVED','CONFIRMED') AND coalesce(estornado_centavos,0)=0))
      WHERE s.academia_id=$1`,[id]);
    await client.query(`UPDATE wcfit_autogestao SET meio=$2,checkout_id=NULL,checkout_referencia=NULL,
      checkout_encerrado_em=NULL,autorizado_em=clock_timestamp(),autorizado_por=$3 WHERE academia_id=$1`,
    [id,meio,ator.usuarioId]);
    await auditar(`comercial_troca_meio:${id}:${anterior.meio}:${meio}:${anterior.checkout_id || '-'}`,null,client);
  });
}

async function processarPixAgendado(api) {
  if (!await disponivel()) return;
  const { rows:[pendente] } = await consulta(`
    SELECT g.academia_id,g.autorizado_por FROM wcfit_autogestao g
    JOIN wcfit_assinaturas s USING(academia_id) JOIN academias a ON a.id=g.academia_id
    JOIN usuarios u ON u.id=g.autorizado_por AND u.academia_id=g.academia_id
    WHERE g.meio='PIX' AND g.autorizado_em IS NOT NULL AND g.cancelamento_solicitado_em IS NULL
      AND a.ativo=1 AND u.status='ativo' AND u.cargo='admin'
      AND s.fim_teste <= $1::date AND s.proximo_vencimento <= $1::date AND (a.teste_gratuito_termina_em IS NULL OR
        a.teste_gratuito_termina_em <= ($1::date::timestamp AT TIME ZONE 'America/Fortaleza'))
      AND NOT EXISTS (SELECT 1 FROM wcfit_cortesias c WHERE c.academia_id=g.academia_id AND c.revogada_em IS NULL
        AND c.concedida_em <= $1::date AND (c.ate IS NULL OR c.ate >= $1::date))
      AND EXISTS(SELECT 1 FROM wcfit_asaas_sandbox_operacoes c WHERE c.academia_id=g.academia_id AND c.namespace=$2
        AND c.tipo='cliente' AND c.estado='vinculada')
      AND NOT EXISTS(SELECT 1 FROM wcfit_asaas_sandbox_operacoes o WHERE o.academia_id=g.academia_id
        AND o.tipo='assinatura' AND (o.estado NOT IN ('rejeitada','cancelada') OR
          o.criado_em >= g.autorizado_em))
      AND NOT EXISTS(SELECT 1 FROM wcfit_recebimentos r WHERE r.academia_id=g.academia_id AND
        date_trunc('month',r.competencia::timestamp)=date_trunc('month',greatest(s.proximo_vencimento,$1::date)::timestamp))
    ORDER BY g.autorizado_em LIMIT 1`,[getDataHojeFortaleza(),api.namespace]);
  if (pendente) await asaas.provisionar({ academiaId:pendente.academia_id,usuarioId:pendente.autorizado_por },
    pendente.academia_id,'assinatura',{ meio:'PIX' },api);
}

async function acessoExpirado(academiaId) {
  if (!await disponivel()) return false;
  const { rows: [linha] } = await consulta(`SELECT acesso_ate <= (now() AT TIME ZONE 'America/Fortaleza')::date AS expirado
    FROM wcfit_autogestao WHERE academia_id=$1 AND cancelado_em IS NOT NULL`, [academiaId]);
  return linha?.expirado === true;
}

async function recuperarCheckout(corpo, namespace) {
  const { id, externalReference } = corpo?.checkout || {};
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id || '') ||
      typeof externalReference !== 'string' || !externalReference.startsWith('wcfit-' + namespace + '-checkout-') ||
      !await disponivel()) return;
  const terminal = ['CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(corpo.event);
  await consulta(`UPDATE wcfit_autogestao SET checkout_id=$1,checkout_incerto=false,
      checkout_encerrado_em=CASE WHEN $3 THEN coalesce(checkout_encerrado_em,clock_timestamp()) ELSE checkout_encerrado_em END
    WHERE checkout_referencia=$2 AND (checkout_id IS NULL OR checkout_id=$1)`, [id,externalReference,terminal]);
}

async function conciliarCheckoutNotificado(checkoutId,api) {
  if (!await disponivel()) return true;
  const { rows:[linha] } = await consulta(`SELECT * FROM wcfit_autogestao WHERE checkout_id=$1
    AND checkout_referencia LIKE $2`,[checkoutId,'wcfit-' + api.namespace + '-checkout-%']);
  if (!linha || linha.cancelado_em) return true;
  const ator = { academiaId:linha.academia_id, usuarioId:linha.autorizado_por };
  return Boolean(await conciliarCheckout(ator,linha.academia_id,api,linha));
}

module.exports = { disponivel, estado, contratar, cancelar, acessoExpirado, recuperarCheckout, processarPixAgendado, conciliarCheckoutNotificado };
