const { createHash } = require('node:crypto');
const { transacao, auditar, autorizarOperacaoRecente } = require('./SuperAdmin');
const { emitirComSessao } = require('./SuperAdminConvite');
const comercial = require('./ComercialWcFit');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');

const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const hash = (s) => createHash('sha256').update(s).digest('hex');

function operar(sessao, executar) {
  return transacao(async (client) => {
    const acesso = await autorizarOperacaoRecente(client, sessao.tokenHash, sessao.semTotpLocal);
    if (!acesso.sessao) throw erro(acesso.status, acesso.status === 428
      ? 'Confirme novamente o código do autenticador.' : 'Sessão administrativa expirada.');
    const { rows: [schema] } = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'academias'::regclass
        AND attname = 'excluida_em' AND NOT attisdropped) AS pronto`);
    if (!schema.pronto) throw erro(503, 'O gerenciamento completo requer a migration 015.');
    return executar(client, acesso.sessao.proprietario_id);
  });
}

const valores = (d) => [d.fantasia, d.tipo, d.documento, d.unidade, d.razao, d.comercial,
  `${d.logradouro}, ${d.numero} - ${d.bairro}, ${d.cidade}/${d.uf}`,
  d.cep, d.logradouro, d.numero, d.complemento || null, d.bairro, d.cidade, d.uf,
  d.email, d.responsavel, d.whatsapp];

async function conferirDocumento(client, documento, id = null) {
  const { rowCount } = await client.query(`
    SELECT 1 FROM academias WHERE id IS DISTINCT FROM $2::integer AND documento_cadastro IS NULL
      AND regexp_replace(upper(cnpj), '[./ -]', '', 'g') = $1 LIMIT 1`, [documento, id]);
  if (rowCount) throw erro(409, 'Documento vinculado a um cadastro legado. Atualize esse cadastro antes de incluir outra unidade.');
}

function criar(sessao, d, condicao, chave) {
  return operar(sessao, async (client, dono) => {
    const prefixo = `academia_criada:${hash(chave)}:`;
    const resumo = hash(JSON.stringify([d, condicao]));
    const { rows: [anterior] } = await client.query(`
      SELECT evento FROM super_admin_auditoria WHERE proprietario_id = $1 AND evento LIKE $2 LIMIT 1`,
    [dono, prefixo + '%']);
    if (anterior) {
      const [, , registro, id] = anterior.evento.split(':');
      if (resumo !== registro) throw erro(409, 'Esta chave já foi usada para outro cadastro.');
      return { id: Number(id), repetido: true };
    }
    const hoje = getDataHojeFortaleza();
    if (condicao.ate && condicao.ate < hoje) throw erro(400, 'A cortesia precisa terminar hoje ou em uma data futura.');
    await conferirDocumento(client, d.documento);
    if (condicao.convite) {
      const { rowCount } = await client.query(`
        SELECT 1 FROM super_admin_convites WHERE email = $1 AND consumido_em IS NULL
          AND revogado_em IS NULL AND expira_em > clock_timestamp()`, [d.email]);
      if (rowCount) throw erro(409, 'O responsável já tem um convite pendente. Confira o convite antes de continuar.');
    }

    const preco = await comercial.precoAtual(client);
    if (preco.valor_centavos !== condicao.preco) throw erro(409, 'A mensalidade mudou. Reabra o formulário para conferir o preço.');
    const dias = condicao.tipo === 'teste' ? 30 : 0;
    const { rows: [academia] } = await client.query(`
      INSERT INTO academias (nome, nome_fantasia, tipo_cadastro, documento_cadastro, unidade_cadastro, razao_social,
        telefone, endereco, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf, email,
        responsavel_nome, responsavel_telefone, ativo, ativar_apos_convite, mensalidade_centavos,
        teste_gratuito_iniciado_em, teste_gratuito_termina_em)
      VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,0,$18,$19,
        CASE WHEN $20::integer > 0 THEN now() END, CASE WHEN $20 > 0 THEN now()+interval '720 hours' END)
      RETURNING id, nome`, [...valores(d), condicao.ativar, preco.valor_centavos, dias]);
    await comercial.iniciarAssinatura(client, academia.id, preco, hoje, dias);
    await auditar(`comercial_assinatura:${academia.id}`, dono, client);
    if (condicao.tipo === 'cortesia') {
      await comercial.registrarCortesia(client, { id: academia.id, hoje, ate: condicao.ate,
        motivo: condicao.motivo, vencimento: hoje, dono });
    }
    let convite;
    if (condicao.convite) {
      convite = await emitirComSessao(client, { academiaId: academia.id, nome: d.responsavel,
        email: d.email, emissor: dono, chave: hash('cadastro-academia:' + chave) });
      if (convite.status !== 201) throw erro(409, 'O e-mail já está vinculado a uma conta administrativa.');
    }
    await auditar(prefixo + resumo + ':' + academia.id, dono, client);
    return { ...academia, token: convite?.token };
  });
}

function visualizar(sessao, id) {
  return operar(sessao, async (client, dono) => {
    if (!id) return { mensalidade_centavos: (await comercial.precoAtual(client)).valor_centavos };
    const { rows: [dados] } = await client.query(`
      SELECT coalesce(nullif(a.nome_fantasia,''),a.nome) AS nome_fantasia, a.razao_social, a.tipo_cadastro AS tipo,
        coalesce(a.documento_cadastro,a.cnpj) AS documento, a.telefone AS whatsapp_comercial, a.endereco,
        a.cep, a.logradouro, a.numero_endereco AS numero, a.complemento, a.bairro, a.cidade, a.uf, a.email,
        coalesce(a.responsavel_nome,u.nome) AS responsavel_nome,
        coalesce(a.responsavel_telefone,u.telefone) AS responsavel_whatsapp, a.email_responsavel_verificado_em,
        a.excluida_em, a.ativar_apos_convite, a.termos_aceitos_url, a.privacidade_aceita_url,
        a.teste_gratuito_termina_em, a.mensalidade_centavos
      FROM academias a LEFT JOIN LATERAL (
        SELECT nome,telefone FROM usuarios WHERE academia_id=a.id AND cargo='admin'
          AND lower(email_ou_matricula)=lower(a.email) ORDER BY id LIMIT 1
      ) u ON true WHERE a.id=$1`, [id]);
    if (!dados) throw erro(404, 'Academia não encontrada.');
    await auditar(`academia_cadastro_consultado:${id}`, dono, client);
    return dados;
  });
}

async function revogarConvites(client, id, dono, email = null) {
  const { rows } = await client.query(`
    UPDATE super_admin_convites SET revogado_em=clock_timestamp() WHERE academia_id=$1 AND consumido_em IS NULL
      AND revogado_em IS NULL AND ($2::text IS NULL OR email=$2) RETURNING id`, [id, email]);
  for (const convite of rows) await auditar(`convite_revogado:${id}:${convite.id}`, dono, client);
}

function editar(sessao, id, d) {
  return operar(sessao, async (client, dono) => {
    const { rows: [academia] } = await client.query('SELECT email,excluida_em FROM academias WHERE id=$1 FOR UPDATE', [id]);
    if (!academia) throw erro(404, 'Academia não encontrada.');
    if (academia.excluida_em) throw erro(409, 'Academia excluída.');
    await conferirDocumento(client, d.documento, id);
    if (academia.email && academia.email !== d.email) await revogarConvites(client, id, dono, academia.email);
    await client.query(`
      UPDATE academias SET nome=$1,nome_fantasia=$1,tipo_cadastro=$2,documento_cadastro=$3,unidade_cadastro=$4,
        razao_social=$5,telefone=$6,endereco=$7,cep=$8,logradouro=$9,numero_endereco=$10,complemento=$11,
        bairro=$12,cidade=$13,uf=$14,email=$15,responsavel_nome=$16,responsavel_telefone=$17,
        email_responsavel_verificado_em=CASE WHEN email=$15 THEN email_responsavel_verificado_em END,
        ativar_apos_convite=ativar_apos_convite AND coalesce(email=$15,false)
      WHERE id=$18`, [...valores(d), id]);
    await auditar(`academia_editada:${id}`, dono, client);
  });
}

function excluir(sessao, id, definitiva) {
  return operar(sessao, async (client, dono) => {
    if (definitiva) await client.query("SET LOCAL lock_timeout = '2s'");
    const { rows: [academia] } = await client.query('SELECT excluida_em FROM academias WHERE id=$1 FOR UPDATE', [id]);
    if (!academia) throw erro(404, 'Academia não encontrada.');
    if (definitiva) {
      if (!academia.excluida_em) throw erro(409, 'Exclua logicamente a academia primeiro.');
      await excluirSemVinculos(client, id);
      await auditar(`academia_excluida_definitivamente:${id}`, dono, client);
      return;
    }
    if (academia.excluida_em) return;
    const { rows: [schema] } = await client.query("SELECT to_regclass('public.wcfit_autogestao') IS NOT NULL AS pronta");
    if (schema.pronta) {
      const { rowCount } = await client.query(`SELECT 1 FROM wcfit_autogestao WHERE academia_id=$1
        AND checkout_referencia IS NOT NULL AND cancelado_em IS NULL`, [id]);
      if (rowCount) throw erro(409,'Encerre o Checkout e a assinatura antes de excluir a academia.');
    }
    const { rowCount } = await client.query(`
      SELECT 1 FROM wcfit_asaas_sandbox_operacoes WHERE academia_id=$1 AND tipo='assinatura'
        AND estado IN ('enviando','incerta','vinculada','cancelando')
      UNION ALL
      SELECT 1 FROM wcfit_assinaturas WHERE academia_id=$1 AND provedor IS NOT NULL AND cliente_externo_id IS NOT NULL`, [id]);
    if (rowCount) throw erro(409, 'Concilie e encerre o vínculo de cobrança externa antes de excluir a academia.');
    await client.query(`UPDATE academias SET ativo=0,versao_sessao=versao_sessao+1,
      excluida_em=clock_timestamp(),ativar_apos_convite=false WHERE id=$1`, [id]);
    await client.query(`UPDATE usuario_sessoes s SET revogada_em=clock_timestamp()
      FROM usuarios u WHERE u.academia_id=$1 AND s.usuario_id=u.id AND s.revogada_em IS NULL`, [id]);
    await revogarConvites(client, id, dono);
    await auditar(`academia_excluida:${id}`, dono, client);
  });
}

async function excluirSemVinculos(client, id) {
  // Bloqueia também tabelas legadas sem FK, antes de consultar seus vínculos.
  const { rows: legadas } = await client.query(`
    SELECT format('%I.%I', n.nspname,t.relname) AS tabela
    FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attname='academia_id' AND NOT a.attisdropped
    WHERE n.nspname='public' AND t.relkind IN ('r','p') AND t.oid<>'public.academias'::regclass
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid=t.oid AND c.contype='f'
        AND c.confrelid='public.academias'::regclass AND c.conkey=ARRAY[a.attnum])
    ORDER BY tabela`);
  if (legadas.length) await client.query(`LOCK TABLE ${legadas.map(({ tabela }) => tabela).join(', ')} IN SHARE MODE`);
  const { rows: referencias } = await client.query(`
    SELECT format('SELECT 1 FROM %I.%I f JOIN public.academias a ON %s WHERE a.id=$1 LIMIT 1',
      n.nspname,t.relname,string_agg(format('f.%I = a.%I',f.attname,a.attname),' AND ')) AS sql
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    CROSS JOIN LATERAL unnest(c.conkey,c.confkey) AS k(origem,destino)
    JOIN pg_attribute f ON f.attrelid=c.conrelid AND f.attnum=k.origem
    JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.destino
    WHERE c.contype='f' AND c.confrelid='public.academias'::regclass GROUP BY c.oid,n.nspname,t.relname`);
  for (const { sql } of [...referencias, ...legadas.map(({ tabela }) =>
    ({ sql: `SELECT 1 FROM ${tabela} WHERE academia_id=$1 LIMIT 1` }))]) {
    if ((await client.query(sql, [id])).rowCount) {
      throw erro(409, 'A academia tem registros vinculados, como alunos, assinaturas ou histórico. Ela permanece oculta da listagem principal.');
    }
  }
  await client.query('DELETE FROM academias WHERE id=$1', [id]);
}

module.exports = { criar, visualizar, editar, excluir };
