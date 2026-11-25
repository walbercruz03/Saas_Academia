const { consulta, transacao, auditar } = require('../models/SuperAdmin');
const { comAssinatura } = require('../models/ComercialWcFit');
const { criarApi, dadosAssinatura } = require('./asaasSandbox');
const { formatarYMD } = require('../utils/datasFortaleza');
const { normalizarDocumento } = require('../utils/documentosBrasileiros');

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const estadosVivos = "('enviando','incerta','vinculada','cancelando')";
const meios = ['UNDEFINED','PIX','BOLETO','CREDIT_CARD'];

async function disponivel(executor = { query: consulta }) {
  const { rows: [row] } = await executor.query("SELECT to_regclass('public.wcfit_asaas_sandbox_operacoes') IS NOT NULL AS pronto");
  return row.pronto;
}

async function exigirSchema() {
  if (!await disponivel()) throw erro(503,'A migration 012 é necessária para operar o Asaas Sandbox.');
}

function estadoPublico(registro) {
  return registro && { estado: registro.estado, meio: registro.meio, vencimento_inicial: registro.vencimento_inicial };
}

async function obterViva(executor, academiaId, tipo) {
  const { rows: [operacao] } = await executor.query(`
    SELECT *,vencimento_inicial::text FROM wcfit_asaas_sandbox_operacoes
    WHERE academia_id=$1 AND tipo=$2 AND estado IN ${estadosVivos}`, [academiaId,tipo]);
  return operacao;
}

async function estado(academiaId) {
  if (process.env.ASAAS_SANDBOX_ATIVO !== 'true' || !await disponivel()) return null;
  const banco = { query: consulta };
  const [cliente, assinatura, historico] = await Promise.all([
    obterViva(banco, academiaId, 'cliente'), obterViva(banco, academiaId, 'assinatura'),
    consulta("SELECT 1 FROM wcfit_asaas_sandbox_operacoes WHERE academia_id=$1 AND tipo='assinatura' AND externo_id IS NOT NULL LIMIT 1",
      [academiaId]),
  ]);
  return { cliente: estadoPublico(cliente), assinatura: estadoPublico(assinatura), historico: historico.rowCount > 0 };
}

async function reservar(token, academiaId, tipo, api, meio) {
  return comAssinatura(token,academiaId,async (client,dono,contrato,cortesia,hoje) => {
    const { rows: [schema] } = await client.query("SELECT to_regclass('public.wcfit_autogestao') IS NOT NULL AS ativa");
    if (schema.ativa && tipo === 'assinatura') {
      const { rows: [controle] } = await client.query('SELECT * FROM wcfit_autogestao WHERE academia_id=$1', [academiaId]);
      if (controle?.cancelamento_solicitado_em || controle?.checkout_referencia ||
          (controle?.meio && controle.meio !== meio) || (typeof token !== 'string' && !controle?.meio)) {
        throw erro(409,'A assinatura possui uma operação comercial que precisa ser concluída.');
      }
    }
    const anterior = await obterViva(client,academiaId,tipo);
    if (anterior) {
      if (anterior.namespace !== api.namespace) throw erro(409,'O vínculo Sandbox pertence a outra configuração.');
      return { controle: anterior, nova: false };
    }
    const cliente = tipo === 'assinatura' && await obterViva(client,academiaId,'cliente');
    let assinatura;
    if (tipo === 'assinatura') {
      if (cliente?.estado !== 'vinculada' || cliente.namespace !== api.namespace) {
        throw erro(409,'Vincule o cliente Sandbox antes da assinatura.');
      }
      assinatura = dadosAssinatura({
        academiaId, cliente:cliente.externo_id, mensalidadeCentavos:contrato.mensalidade_centavos,
        fimTeste:contrato.primeiro_dia_cobravel, proximoVencimento:contrato.proximo_vencimento,
        cortesiaAtiva:Boolean(cortesia), meio,
      },api.namespace,hoje);
      const { rowCount } = await client.query(`
        SELECT 1 FROM wcfit_recebimentos WHERE academia_id=$1
          AND date_trunc('month',competencia::timestamp)=date_trunc('month',$2::date::timestamp)`,
      [academiaId,assinatura.nextDueDate]);
      if (rowCount) throw erro(409,'Esta competência já possui recebimento manual.');
    }
    const { rows: [controle] } = await client.query(`
      INSERT INTO wcfit_asaas_sandbox_operacoes
        (academia_id,namespace,tipo,estado,cliente_id,vencimento_inicial,valor_centavos,meio)
      VALUES ($1,$2,$3,'enviando',$4,$5,$6,$7) RETURNING *,vencimento_inicial::text`,
    [academiaId,api.namespace,tipo,cliente?.externo_id || null,assinatura?.nextDueDate ?? null,
      assinatura ? contrato.mensalidade_centavos : null,assinatura?.billingType ?? null]);
    await auditar(`comercial_asaas_reserva:${academiaId}:${controle.id}`,dono,client);
    return { controle, nova:true, hoje, fimTeste:contrato.primeiro_dia_cobravel };
  });
}

async function salvarVinculo(op, retorno) {
  await transacao(async (client) => {
    const { rows: [atual] } = await client.query('SELECT externo_id,estado FROM wcfit_asaas_sandbox_operacoes WHERE id=$1 FOR UPDATE',[op.id]);
    if (atual.externo_id === retorno.id) return;
    if (!['enviando','incerta'].includes(atual.estado) || atual.externo_id) {
      throw erro(409,'O vínculo Sandbox já mudou.');
    }
    await client.query(`
      UPDATE wcfit_asaas_sandbox_operacoes SET externo_id=$2,estado=$3,atualizado_em=clock_timestamp()
      WHERE id=$1`,[op.id,retorno.id,retorno.removida ? 'cancelada' : 'vinculada']);
  });
}

async function mudarEnvio(id, destino) {
  await consulta(`
    UPDATE wcfit_asaas_sandbox_operacoes SET estado=$2,atualizado_em=clock_timestamp()
    WHERE id=$1 AND estado='enviando'`,[id,destino]);
}

async function consultarReferencia(api, op) {
  const retorno = op.tipo === 'cliente' ? await api.consultarCliente(op.academia_id) :
    await api.consultarAssinatura(op.academia_id,op.cliente_id,op.id);
  if (retorno && op.tipo === 'assinatura' && retorno.mensalidadeCentavos !== op.valor_centavos) {
    throw erro(409,'A assinatura retornada diverge do valor contratado no Sandbox.');
  }
  return retorno;
}

async function verificarCompetencia(api, op) {
  const { rows } = await consulta(`
    SELECT externo_id,cliente_id,namespace FROM wcfit_asaas_sandbox_operacoes
    WHERE academia_id=$1 AND tipo='assinatura' AND estado='cancelada'`,[op.academia_id]);
  if (!rows.length) return;
  const [ano,mes] = op.vencimento_inicial.split('-').map(Number);
  const intervalo = { inicio:formatarYMD(ano,mes,1),fim:formatarYMD(ano,mes+1,0) };
  for (const anterior of rows) {
    if (anterior.namespace !== api.namespace) throw erro(409,'Histórico Sandbox pertence a outra configuração.');
    const { cobrancas, temMais } = await api.listarCobrancas(anterior.cliente_id,anterior.externo_id,0,intervalo);
    if (temMais || cobrancas.some((item) => !['DELETED','REFUNDED'].includes(item.status))) {
      throw erro(409,'Já existe uma cobrança Sandbox para esta competência.');
    }
  }
}

async function provisionar(token, academiaId, tipo, { documento, meio } = {}, api = criarApi()) {
  await exigirSchema();
  const tipoDocumento = typeof documento === 'string' && documento.replace(/[.\-/]/g,'').length === 11 ? 'pessoa_fisica' : 'empresa';
  if (tipo === 'cliente' && documento !== undefined && !normalizarDocumento(documento,tipoDocumento)) {
    throw erro(400,'Informe um documento sintético válido.');
  }
  if (tipo === 'assinatura' && !meios.includes(meio)) throw erro(400,'Forma de pagamento Sandbox inválida.');
  const { controle:op,nova,hoje,fimTeste } = await reservar(token,academiaId,tipo,api,meio);
  if (op.estado === 'vinculada') return { estado:'vinculada', repetido:true };
  if (op.estado === 'cancelando') throw erro(409,'A recorrência Sandbox está sendo encerrada.');
  if (!nova) {
    const retorno = await consultarReferencia(api,op);
    if (!retorno) throw erro(409,'Envio Sandbox pendente de conciliação. Nenhuma nova criação foi enviada.');
    await salvarVinculo(op,retorno);
    return { estado:retorno.removida ? 'cancelada' : 'vinculada', repetido:true };
  }

  let confirmou;
  let enviou = false;
  let consultou = false;
  try {
    confirmou = await consultarReferencia(api,op);
    consultou = true;
    if (!confirmou) {
      if (tipo === 'cliente' && !documento) throw erro(400,'Informe um documento sintético para criar o cliente Sandbox.');
      if (tipo === 'assinatura') await verificarCompetencia(api,op);
      enviou = true;
      confirmou = tipo === 'cliente'
        ? await api.criarCliente({ nome:`Academia WC Fit Sandbox #${academiaId}`, documento, tipo:tipoDocumento, academiaId })
        : await api.criarAssinatura({
          academiaId, geracao:op.id, cliente:op.cliente_id, mensalidadeCentavos:op.valor_centavos,
          fimTeste, proximoVencimento:op.vencimento_inicial, cortesiaAtiva:false, meio:op.meio,
        }, hoje);
    }
    await salvarVinculo(op,confirmou);
    return { estado:confirmou.removida ? 'cancelada' : 'vinculada', repetido:false };
  } catch (falha) {
    const erroDefinitivo = [400,401,403,404,422].includes(falha.externo) && !falha.incerto;
    const ambigua = !consultou && falha.status === 409;
    await mudarEnvio(op.id, confirmou || ambigua || (enviou && !erroDefinitivo) ? 'incerta' : 'rejeitada');
    throw falha;
  }
}

async function cancelar(token,academiaId,api = criarApi()) {
  await exigirSchema();
  const anterior = await comAssinatura(token,academiaId,(client) => obterViva(client,academiaId,'assinatura'));
  if (anterior?.namespace !== api.namespace && anterior) throw erro(409,'O vínculo Sandbox pertence a outra configuração.');
  if (anterior && ['enviando','incerta'].includes(anterior.estado)) {
    const retorno = await consultarReferencia(api,anterior);
    if (!retorno) throw erro(409,'Conciliação pendente. Nenhuma nova cobrança foi enviada.');
    await salvarVinculo(anterior,retorno);
  }
  const op = await comAssinatura(token,academiaId,async (client,dono) => {
    const anterior = await obterViva(client,academiaId,'assinatura');
    if (!anterior) return null;
    if (anterior.namespace !== api.namespace) throw erro(409,'O vínculo Sandbox pertence a outra configuração.');
    if (!['vinculada','cancelando'].includes(anterior.estado)) {
      throw erro(409,'Concilie a criação antes de encerrar a recorrência Sandbox.');
    }
    if (anterior.estado === 'vinculada') {
      await client.query("UPDATE wcfit_asaas_sandbox_operacoes SET estado='cancelando',atualizado_em=clock_timestamp() WHERE id=$1",[anterior.id]);
      await auditar(`comercial_asaas_cancelamento:${academiaId}:${anterior.id}`,dono,client);
    }
    return anterior;
  });
  if (!op) return { estado:'cancelada', repetido:true };
  const vinculo = await api.consultarAssinaturaPorId(op.externo_id,op.cliente_id,op.valor_centavos);
  if (vinculo && vinculo.id !== op.externo_id) throw erro(409,'Vínculo Sandbox divergente.');
  if (!vinculo?.removida && !await api.removerAssinatura(op.externo_id)) {
    throw erro(502,'O encerramento Sandbox ainda não foi confirmado.');
  }
  await consulta(`
    UPDATE wcfit_asaas_sandbox_operacoes SET estado='cancelada',atualizado_em=clock_timestamp()
    WHERE id=$1 AND estado='cancelando'`,[op.id]);
  return { estado:'cancelada', repetido:false };
}

async function vinculos(academiaId, namespace) {
  const { rows } = await consulta(`
    SELECT id, externo_id, cliente_id, estado FROM wcfit_asaas_sandbox_operacoes
    WHERE academia_id=$1 AND namespace=$2 AND tipo='assinatura' AND externo_id IS NOT NULL
    ORDER BY id DESC`,[academiaId,namespace]);
  return rows;
}

module.exports = { disponivel, exigirSchema, estado, provisionar, cancelar, vinculos, estadosVivos };
