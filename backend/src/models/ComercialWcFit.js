const { createHash } = require('node:crypto');
const { consulta, transacao, auditar, buscarSessao } = require('./SuperAdmin');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const banco = { query: consulta };

async function disponivel(executor = banco) {
  const { rows: [row] } = await executor.query("SELECT to_regclass('public.wcfit_assinaturas') IS NOT NULL AS pronto");
  return row.pronto;
}

async function precoAtual(executor = banco) {
  const { rows: [preco] } = await executor.query(
    'SELECT id, valor_centavos, vigente_desde FROM wcfit_precos ORDER BY id DESC LIMIT 1');
  return preco;
}

const cortesiaVigente = `x.revogada_em IS NULL AND x.concedida_em <= $1::date AND (x.ate IS NULL OR x.ate >= $1::date)`;
const situacao = `CASE
  WHEN to_jsonb(a)->>'excluida_em' IS NOT NULL THEN 'excluida'
  WHEN s.academia_id IS NULL THEN 'transicao'
  WHEN c.id IS NOT NULL THEN 'cortesia'
  WHEN s.fim_teste > $1::date THEN 'teste_gratuito'
  WHEN s.proximo_vencimento < $1::date THEN 'inadimplente'
  ELSE 'ativa' END`;
const juntar = `
  FROM academias a LEFT JOIN wcfit_assinaturas s ON s.academia_id = a.id
  LEFT JOIN LATERAL (
    SELECT x.id, x.ate FROM wcfit_cortesias x WHERE x.academia_id = a.id AND ${cortesiaVigente}
    ORDER BY x.id DESC LIMIT 1
  ) c ON true`;

async function indicadores() {
  if (!await disponivel()) return null;
  const { rows: [dados] } = await consulta(`
    WITH situacoes AS (
      SELECT ${situacao} AS situacao, s.mensalidade_centavos, c.ate ${juntar} WHERE to_jsonb(a)->>'excluida_em' IS NULL
    )
    SELECT count(*) FILTER (WHERE situacao='teste_gratuito') AS testes,
      count(*) FILTER (WHERE situacao='ativa') AS ativas,
      count(*) FILTER (WHERE situacao='inadimplente') AS inadimplentes,
      count(*) FILTER (WHERE situacao='cortesia') AS cortesias,
      count(*) FILTER (WHERE situacao='cortesia' AND ate IS NULL) AS cortesias_permanentes,
      count(*) FILTER (WHERE situacao='transicao') AS transicao,
      coalesce(sum(mensalidade_centavos) FILTER (WHERE situacao='ativa'),0) AS recorrente_centavos,
      (SELECT coalesce(sum(valor_centavos),0) FROM wcfit_recebimentos
        WHERE recebido_em >= date_trunc('month',$1::date) AND recebido_em <= $1::date) AS recebido_mes_centavos
    FROM situacoes`, [getDataHojeFortaleza()]);
  return Object.fromEntries(Object.entries(dados).map(([campo, valor]) => [campo, Number(valor)]));
}

async function listar({ busca, pagina }) {
  const hoje = getDataHojeFortaleza();
  const { rows: academias } = await consulta(`
    SELECT a.id, a.nome, ${situacao} AS situacao, s.mensalidade_centavos,
      s.fim_teste::text, s.proximo_vencimento::text, c.ate::text AS cortesia_ate
    ${juntar}
    WHERE to_jsonb(a)->>'excluida_em' IS NULL AND ($2 = '' OR strpos(lower(a.nome),lower($2)) > 0 OR a.id::text = $2)
    ORDER BY lower(a.nome),a.id LIMIT 21 OFFSET $3`, [hoje, busca, (pagina - 1) * 20]);
  const { rows: precos } = await consulta(
    'SELECT id,valor_centavos,vigente_desde FROM wcfit_precos ORDER BY id DESC');
  return { hoje, registros: academias.slice(0,20), pagina, temMais: academias.length > 20, precos };
}

async function detalhes(id, pagina) {
  const hoje = getDataHojeFortaleza();
  const { rows: [academia] } = await consulta(`
    SELECT a.id, a.nome, ${situacao} AS situacao, s.mensalidade_centavos, s.inicio_teste::text,
      s.fim_teste::text, s.proximo_vencimento::text, c.ate::text AS cortesia_ate,
      coalesce(s.provedor = 'asaas_sandbox' AND s.cliente_externo_id IS NOT NULL, false) AS asaas_sandbox_vinculado
    ${juntar} WHERE a.id = $2`, [hoje,id]);
  if (!academia) throw erro(404,'Academia não encontrada.');
  const offset = (pagina - 1) * 20;
  const [cortesias, recebimentos] = await Promise.all([
    consulta(`SELECT id,concedida_em::text,ate::text,motivo,revogada_em::text,motivo_revogacao
      FROM wcfit_cortesias WHERE academia_id=$1 ORDER BY id DESC LIMIT 21 OFFSET $2`, [id,offset]),
    consulta(`SELECT id,competencia::text,recebido_em::text,valor_centavos,referencia
      FROM wcfit_recebimentos WHERE academia_id=$1 ORDER BY id DESC LIMIT 21 OFFSET $2`, [id,offset]),
  ]);
  return { hoje, academia, pagina, temMais: cortesias.rowCount > 20 || recebimentos.rowCount > 20,
    temMaisRecebimentos: recebimentos.rowCount > 20,
    cortesias:cortesias.rows.slice(0,20), recebimentos:recebimentos.rows.slice(0,20) };
}

async function clienteAsaasSandbox(id) {
  const { rows: [assinatura] } = await consulta(`
    SELECT cliente_externo_id FROM wcfit_assinaturas WHERE academia_id = $1 AND provedor = 'asaas_sandbox'
  `, [id]);
  return assinatura?.cliente_externo_id;
}

async function iniciarAssinatura(client, academia, preco, hoje, dias = 30) {
  if (dias === 0) {
    const { rows: [assinatura] } = await client.query(`
      INSERT INTO wcfit_assinaturas (academia_id,preco_id,mensalidade_centavos,inicio_teste,fim_teste,
        dia_vencimento,proximo_vencimento,dias_teste)
      VALUES ($1,$2,$3,$4::date,$4::date,extract(day FROM $4::date),$4::date,0)
      ON CONFLICT (academia_id) DO NOTHING RETURNING academia_id`, [academia,preco.id,preco.valor_centavos,hoje]);
    return assinatura;
  }
  const { rows: [assinatura] } = await client.query(`
    INSERT INTO wcfit_assinaturas (academia_id,preco_id,mensalidade_centavos,inicio_teste,fim_teste,dia_vencimento,proximo_vencimento)
    VALUES ($1,$2,$3,$4::date,$4::date+30,extract(day FROM $4::date+30),$4::date+30)
    ON CONFLICT (academia_id) DO NOTHING RETURNING academia_id`, [academia,preco.id,preco.valor_centavos,hoje]);
  return assinatura;
}

function gravar(token, executar) {
  return transacao(async (client) => {
    const sessao = await buscarSessao(token, client, true);
    if (sessao?.etapa !== 'autenticada') throw erro(401,'Sessão administrativa expirada.');
    return executar(client, sessao.proprietario_id);
  });
}

async function alterarPreco(token, valor) {
  return gravar(token, async (client, dono) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wcfit:comercial:preco'))");
    const atual = await precoAtual(client);
    if (atual.valor_centavos === valor) return atual;
    const { rows: [novo] } = await client.query(`
      INSERT INTO wcfit_precos (valor_centavos) VALUES ($1)
      RETURNING id,valor_centavos,vigente_desde`, [valor]);
    await auditar(`comercial_preco:${novo.id}`, dono, client);
    return novo;
  });
}

async function iniciar(token, id) {
  return gravar(token, async (client, dono) => {
    const existe = await client.query(`SELECT a.id FROM academias a WHERE id=$1 AND to_jsonb(a)->>'excluida_em' IS NULL FOR KEY SHARE`,[id]);
    if (!existe.rowCount) throw erro(404,'Academia não encontrada.');
    const preco = await precoAtual(client);
    if (!await iniciarAssinatura(client,id,preco,getDataHojeFortaleza())) {
      throw erro(409,'A academia já tem uma assinatura.');
    }
    await auditar(`comercial_assinatura:${id}`,dono,client);
  });
}

function comAssinatura(token,id,executar) {
  const executarTransacao = typeof token === 'string' ? (fn) => gravar(token, fn) : (fn) => transacao(async (client) => {
    const acesso = await client.query(`SELECT 1 FROM usuarios WHERE id=$1 AND academia_id=$2
      AND cargo='admin' AND status='ativo' AND excluido_em IS NULL FOR SHARE`, [token.usuarioId,id]);
    if (!acesso.rowCount || token.academiaId !== id) throw erro(403,'Operação comercial não autorizada.');
    return fn(client,null);
  });
  return executarTransacao(async (client,dono) => {
    const academia = await client.query(`SELECT 1 FROM academias a WHERE id=$1
      AND to_jsonb(a)->>'excluida_em' IS NULL FOR SHARE`,[id]);
    if (!academia.rowCount) throw erro(404,'Academia não encontrada.');
    const { rows: [assinatura] } = await client.query(`
      SELECT s.inicio_teste::text,s.fim_teste::text,s.proximo_vencimento::text,s.mensalidade_centavos,
        greatest(s.fim_teste, (a.teste_gratuito_termina_em AT TIME ZONE 'America/Fortaleza')::date
          + CASE WHEN (a.teste_gratuito_termina_em AT TIME ZONE 'America/Fortaleza')::time > time '00:00' THEN 1 ELSE 0 END
        )::text AS primeiro_dia_cobravel
      FROM wcfit_assinaturas s JOIN academias a ON a.id=s.academia_id
      WHERE s.academia_id=$1 AND to_jsonb(a)->>'excluida_em' IS NULL FOR UPDATE OF s`,[id]);
    if (!assinatura) throw erro(404,'Assinatura não encontrada.');
    const hoje = getDataHojeFortaleza();
    const { rows: [cortesia] } = await client.query(`
      SELECT x.id,x.vencimento_anterior::text FROM wcfit_cortesias x
      WHERE x.academia_id=$2 AND ${cortesiaVigente} ORDER BY x.id DESC LIMIT 1`,[hoje,id]);
    return executar(client,dono,assinatura,cortesia,hoje);
  });
}

async function registrarCortesia(client, { id, hoje, ate, motivo, vencimento, dono }) {
  const { rows: [nova] } = await client.query(`
    INSERT INTO wcfit_cortesias (academia_id,concedida_em,ate,motivo,vencimento_anterior)
    VALUES ($1,$2,$3,$4,$5) RETURNING id`,[id,hoje,ate,motivo,vencimento]);
  if (ate) await client.query(`
    UPDATE wcfit_assinaturas SET proximo_vencimento=greatest(proximo_vencimento,$2::date+1)
    WHERE academia_id=$1`,[id,ate]);
  await auditar(`comercial_cortesia_concedida:${id}:${nova.id}`,dono,client);
}

function conceder(token,id,ate,motivo) {
  return comAssinatura(token,id,async (client,dono,assinatura,cortesia,hoje) => {
    if (ate && ate < hoje) throw erro(400,'Informe uma data de término a partir de hoje.');
    if (cortesia) throw erro(409,'Já existe uma cortesia vigente.');
    const { rows: [schema] } = await client.query("SELECT to_regclass('public.wcfit_asaas_sandbox_operacoes') IS NOT NULL AS pronto");
    if (schema.pronto) {
      const { rowCount } = await client.query(`
        SELECT 1 FROM wcfit_asaas_sandbox_operacoes WHERE academia_id=$1 AND tipo='assinatura'
          AND estado IN ('enviando','incerta','vinculada','cancelando')`, [id]);
      if (rowCount) throw erro(409,'Concilie e encerre a recorrência Sandbox antes de conceder a cortesia.');
    }
    await registrarCortesia(client, { id, hoje, ate, motivo, vencimento: assinatura.proximo_vencimento, dono });
  });
}

function revogar(token,id,motivo) {
  return comAssinatura(token,id,async (client,dono,_assinatura,cortesia,hoje) => {
    if (!cortesia) throw erro(409,'A academia não tem cortesia vigente.');
    await client.query('UPDATE wcfit_cortesias SET revogada_em=$2,motivo_revogacao=$3 WHERE id=$1',[cortesia.id,hoje,motivo]);
    await client.query(`
      UPDATE wcfit_assinaturas SET proximo_vencimento=greatest($2::date,$3::date) WHERE academia_id=$1`,
    [id,hoje,cortesia.vencimento_anterior]);
    await auditar(`comercial_cortesia_revogada:${id}:${cortesia.id}`,dono,client);
  });
}

function receber(token,id,{ competencia, recebidoEm, referencia, chave }) {
  return comAssinatura(token,id,async (client,dono,assinatura,cortesia,hoje) => {
    const hash = createHash('sha256').update(chave).digest();
    const { rows: [anterior] } = await client.query(`
      SELECT id,academia_id,competencia::text,recebido_em::text,referencia
      FROM wcfit_recebimentos WHERE chave_hash=$1`,[hash]);
    if (anterior) {
      if (anterior.academia_id !== id || anterior.competencia !== competencia ||
          anterior.recebido_em !== recebidoEm || anterior.referencia !== referencia) {
        throw erro(409,'A chave já foi usada em outro recebimento.');
      }
      return { id: anterior.id, repetido:true };
    }
    const { rows: [schema] } = await client.query("SELECT to_regclass('public.wcfit_autogestao') IS NOT NULL AS pronta");
    if (schema.pronta && (await client.query(`SELECT 1 FROM wcfit_autogestao WHERE academia_id=$1
      AND (cancelamento_solicitado_em IS NOT NULL OR checkout_referencia IS NOT NULL)`,[id])).rowCount) {
      throw erro(409,'O contrato possui uma operação comercial em andamento ou foi cancelado.');
    }
    if (cortesia || assinatura.fim_teste > hoje || recebidoEm < assinatura.fim_teste || recebidoEm > hoje) {
      throw erro(409,'O recebimento está fora do período de cobrança.');
    }
    if (competencia !== assinatura.proximo_vencimento) throw erro(409,'O vencimento mudou. Consulte a assinatura novamente.');
    const { rows: [novo] } = await client.query(`
      INSERT INTO wcfit_recebimentos (academia_id,competencia,recebido_em,valor_centavos,referencia,chave_hash)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
    [id,competencia,recebidoEm,assinatura.mensalidade_centavos,referencia,hash]);
    if (!novo) throw erro(409,'Já existe um recebimento para esta chave ou vencimento.');
    await client.query(`
      UPDATE wcfit_assinaturas SET proximo_vencimento=
        (date_trunc('month',proximo_vencimento::timestamp)+interval '1 month')::date
        + least(dia_vencimento,extract(day FROM date_trunc('month',proximo_vencimento::timestamp)+interval '2 months - 1 day')::int)-1
      WHERE academia_id=$1`,[id]);
    await auditar(`comercial_recebimento:${id}:${novo.id}`,dono,client);
    return { id:novo.id, repetido:false };
  });
}

module.exports = { disponivel, precoAtual, indicadores, listar, detalhes, clienteAsaasSandbox, iniciarAssinatura, registrarCortesia, alterarPreco, iniciar, conceder, revogar, receber, comAssinatura };
