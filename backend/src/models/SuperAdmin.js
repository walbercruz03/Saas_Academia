const { createHash } = require('node:crypto');
const db = require('../config/database');
const { emitirToken, hashSessao } = require('../services/superAdminSeguranca');

const consulta = (sql, params) => {
  if (db.isSqlite) throw Object.assign(new Error('Administração global indisponível.'), { status: 503 });
  return db.pool.query(sql, params);
};

async function transacao(executar) {
  if (db.isSqlite) throw Object.assign(new Error('Administração global indisponível.'), { status: 503 });
  const client = await db.pool.connect();
  let descartar = false;
  try {
    await client.query('BEGIN');
    const resultado = await executar(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    try { await client.query('ROLLBACK'); } catch { descartar = true; }
    throw erro;
  } finally {
    client.release(descartar);
  }
}

async function auditar(evento, proprietario = null, client = { query: consulta }) {
  await client.query('INSERT INTO super_admin_auditoria (evento, proprietario_id) VALUES ($1, $2)', [evento, proprietario]);
}

async function criarProprietario(email, senhaHash) {
  return transacao(async (client) => {
    const { rowCount } = await client.query(
      'INSERT INTO super_admin_identidade (email, senha_hash) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [email, senhaHash]);
    if (rowCount) await auditar('proprietario_criado', 1, client);
    return Boolean(rowCount);
  });
}

async function limitar(escopo, maximo) {
  const { rows: [row] } = await consulta(`
    INSERT INTO super_admin_limites VALUES ($1, now(), 1)
    ON CONFLICT (escopo) DO UPDATE SET
      tentativas = CASE WHEN super_admin_limites.inicio < now() - interval '5 minutes'
                        THEN 1 ELSE LEAST(super_admin_limites.tentativas + 1, $2::integer + 1) END,
      inicio = CASE WHEN super_admin_limites.inicio < now() - interval '5 minutes' THEN now() ELSE super_admin_limites.inicio END
    RETURNING tentativas`, [escopo, maximo]);
  return row.tentativas <= maximo;
}

async function marcarTotp(client, tokenHash) {
  const { rows:[schema] } = await client.query("SELECT to_regclass('public.usuario_sessoes') IS NOT NULL AS pronta");
  if (schema.pronta) await client.query(
    'UPDATE super_admin_sessoes SET totp_confirmado_em=clock_timestamp() WHERE token_hash=$1',[tokenHash]);
}

async function emitirSessao(client, etapa, totpValidado = false) {
  const token = emitirToken();
  const segundos = etapa === 'autenticada' ? 900 : 300;
  await client.query('DELETE FROM super_admin_sessoes WHERE expira_em <= now()');
  await client.query(`INSERT INTO super_admin_sessoes (token_hash, proprietario_id, etapa, expira_em)
    VALUES ($1, 1, $2, now() + make_interval(secs => $3))`, [hashSessao(token), etapa, segundos]);
  if (totpValidado) await marcarTotp(client,hashSessao(token));
  return { token, segundos, etapa };
}

async function buscarSessao(tokenHash, client = { query: consulta }, bloquear = false) {
  if (bloquear) await client.query('SELECT id FROM super_admin_identidade WHERE id = 1 FOR UPDATE');
  const { rows: [row] } = await client.query(`
    SELECT s.*, p.email, p.totp_cifrado, p.ultimo_passo_totp
    FROM super_admin_sessoes s JOIN super_admin_identidade p ON p.id = s.proprietario_id
    WHERE s.token_hash = $1 AND s.expira_em > clock_timestamp() AND p.ativo
    ${bloquear ? 'FOR UPDATE OF s' : ''}`, [tokenHash]);
  return row;
}

async function indicadores() {
  const { rows: [row] } = await consulta(`
    SELECT
      (SELECT COUNT(*) FROM academias a WHERE to_jsonb(a)->>'excluida_em' IS NULL) AS academias,
      (SELECT COUNT(*) FROM academias WHERE ativo = 1) AS ativas,
      (SELECT COUNT(*) FROM academias a WHERE ativo IS DISTINCT FROM 1 AND to_jsonb(a)->>'excluida_em' IS NULL) AS inativas,
      COUNT(*) FILTER (WHERE u.cargo = 'admin' AND to_jsonb(u)->>'excluido_em' IS NULL) AS administradores,
      COUNT(*) FILTER (WHERE u.cargo = 'professor') AS professores
    FROM usuarios u JOIN academias a ON a.id = u.academia_id WHERE to_jsonb(a)->>'excluida_em' IS NULL
  `);
  return Object.fromEntries(Object.entries(row).map(([campo, valor]) => [campo, Number(valor)]));
}

// Somente o histórico próprio e a auditoria do cadastro manual comprovam a origem.
const situacaoOperacional = `
  CASE WHEN to_jsonb(a)->>'excluida_em' IS NOT NULL THEN 'excluida'
       WHEN a.ativo = 1 THEN 'ativa'
       WHEN (SELECT h.estado_novo FROM academias_historico_operacional h
             WHERE h.academia_id = a.id ORDER BY h.id DESC LIMIT 1) = 'suspensa' THEN 'suspensa'
       WHEN a.versao_sessao = 0 AND NOT EXISTS (
         SELECT 1 FROM academias_historico_operacional h WHERE h.academia_id = a.id
       ) AND EXISTS (
         SELECT 1 FROM super_admin_auditoria sa
         WHERE sa.proprietario_id IS NOT NULL
           AND substring(sa.evento FROM '^academia_criada:[a-f0-9]{64}:[a-f0-9]{64}:([0-9]+)$') = a.id::text
       ) THEN 'aguardando_ativacao'
       ELSE 'inativa_indeterminada' END
`;

async function autorizarOperacaoRecente(client, tokenHash, semTotpLocal = false) {
  const sessao = await buscarSessao(tokenHash, client, true);
  if (sessao?.etapa !== 'autenticada') return { status: 401 };
  if (semTotpLocal) return { sessao };
  const comprovacao = sessao.totp_confirmado_em === undefined ? sessao.criado_em : sessao.totp_confirmado_em;
  const { rows: [row] } = await client.query(
    "SELECT $1::timestamptz > clock_timestamp() - interval '5 minutes' AS recente", [comprovacao]);
  return row.recente ? { sessao } : { status: 428 };
}

async function listarAcademias({ busca, ativo, pagina, excluidas = false, cidade = '', uf = '', tipo = '', documento = '' }) {
  return paginarRegistros(`
    SELECT a.id, a.nome, (a.ativo IS NOT DISTINCT FROM 1) AS ativa,
      ${situacaoOperacional} AS situacao_operacional,
      (a.criado_em AT TIME ZONE current_setting('TimeZone')) AS criado_em,
      cadastro.dados->>'cidade' AS cidade, cadastro.dados->>'uf' AS uf, cadastro.dados->>'tipo_cadastro' AS tipo_cadastro,
      CASE WHEN cadastro.dados->>'documento_cadastro' IS NOT NULL
        THEN '••••' || right(cadastro.dados->>'documento_cadastro', 4) END AS documento_mascarado,
      (SELECT COUNT(*)::integer FROM usuarios u
       WHERE u.academia_id = a.id AND u.cargo = 'admin' AND to_jsonb(u)->>'excluido_em' IS NULL) AS administradores
    FROM academias a
    CROSS JOIN LATERAL (SELECT to_jsonb(a) AS dados) cadastro
    WHERE ($1::text = '' OR strpos(lower(a.nome), lower($1)) > 0)
      AND ($2::boolean IS NULL OR (a.ativo IS NOT DISTINCT FROM 1) = $2)
      AND ($3::text = '' OR strpos(lower(cadastro.dados->>'cidade'), lower($3)) > 0)
      AND ($4::text = '' OR cadastro.dados->>'uf' = $4)
      AND ($5::text = '' OR cadastro.dados->>'tipo_cadastro' = $5)
      AND ($6::text = '' OR coalesce(cadastro.dados->>'documento_cadastro',
        regexp_replace(upper(a.cnpj), '[./ -]', '', 'g')) = $6)
      AND (cadastro.dados->>'excluida_em' IS NOT NULL) = $7
  `, 'lower(f.nome), f.id', [busca, ativo, cidade, uf, tipo, documento, excluidas], pagina);
}

async function obterCadastroAcademia(id) {
  const { rows: [cadastro] } = await consulta(`
    SELECT a.nome_fantasia, a.razao_social, a.tipo_cadastro, a.telefone AS whatsapp_comercial,
      '••••' || right(a.documento_cadastro, 4) AS documento_mascarado,
      a.cep, a.logradouro, a.numero_endereco, a.complemento, a.bairro, a.cidade, a.uf,
      coalesce(to_jsonb(a)->>'responsavel_nome', u.nome) AS responsavel_nome,
      a.email AS responsavel_email, coalesce(to_jsonb(a)->>'responsavel_telefone',u.telefone) AS responsavel_whatsapp,
      a.email_responsavel_verificado_em, a.termos_aceitos_url, a.privacidade_aceita_url,
      a.teste_gratuito_iniciado_em, a.teste_gratuito_termina_em, a.mensalidade_centavos
    FROM academias a LEFT JOIN usuarios u
      ON u.academia_id = a.id AND u.email_ou_matricula = a.email AND u.cargo = 'admin'
    WHERE a.id = $1 AND a.tipo_cadastro IS NOT NULL
  `, [id]);
  return cadastro;
}

async function paginarRegistros(selecao, ordem, parametros, pagina, extras = '') {
  const tamanho = 20;
  const valorPagina = `$${parametros.length + 1}`;
  const { rows: [dados] } = await consulta(`
    WITH filtrados AS (${selecao}), totais AS (
      SELECT count(*)::integer AS total ${extras} FROM filtrados
    ), paginacao AS (
      SELECT totais.*, least(${valorPagina}::integer, greatest(1, (total + ${tamanho - 1}) / ${tamanho})) AS pagina
      FROM totais
    )
    SELECT paginacao.*, total > pagina * ${tamanho} AS "temMais",
      ARRAY(SELECT to_jsonb(f) FROM filtrados f ORDER BY ${ordem}
        LIMIT ${tamanho} OFFSET (paginacao.pagina - 1) * ${tamanho}) AS registros
    FROM paginacao
  `, [...parametros, pagina]);
  return dados;
}

async function listarAdministradores({ busca, academiaId, pagina, excluidos }) {
  return paginarRegistros(`
    SELECT u.id, u.nome, u.email_ou_matricula, u.status,
      (to_jsonb(u)->>'excluido_em' IS NOT NULL) AS excluido,
      a.id AS academia_id, a.nome AS academia_nome,
      CASE WHEN a.id IS NOT NULL THEN a.ativo = 1 END AS academia_ativa
    FROM usuarios u LEFT JOIN academias a ON a.id = u.academia_id
    WHERE u.cargo = 'admin'
      AND ($1::text = '' OR strpos(lower(u.nome), lower($1)) > 0
        OR strpos(lower(u.email_ou_matricula), lower($1)) > 0)
      AND ($2::integer IS NULL OR a.id = $2)
      AND (to_jsonb(u)->>'excluido_em' IS NOT NULL) = $3
      AND ($2 IS NOT NULL OR to_jsonb(a)->>'excluida_em' IS NULL)
  `, 'lower(f.nome), f.id', [busca, academiaId, excluidos], pagina);
}

async function academiaExiste(id) {
  const { rowCount } = await consulta('SELECT 1 FROM academias WHERE id = $1', [id]);
  return rowCount > 0;
}

// O schema de auditoria tem somente o campo textual evento para metadados.
const prefixoCadastro = 'academia_criada:';
const resumir = (valor) => createHash('sha256').update(valor).digest('hex');

async function criarAcademia({ nome, chave, tokenHash }) {
  const prefixoOperacao = prefixoCadastro + resumir(chave) + ':';
  const resumo = resumir(chave + '\0' + nome);
  return transacao(async (client) => {
    // O bloqueio da identidade serializa os cadastros e a revogação de sessão.
    const sessao = await buscarSessao(tokenHash, client, true);
    if (sessao?.etapa !== 'autenticada') return { expirou: true };

    const { rows: [anterior] } = await client.query(`
      SELECT evento FROM super_admin_auditoria
      WHERE proprietario_id = $1 AND evento LIKE $2 ORDER BY id DESC LIMIT 1
    `, [sessao.proprietario_id, prefixoOperacao + '%']);
    if (anterior) {
      const [, , registro, id] = anterior.evento.split(':');
      return registro === resumo
        ? { academia: { id: Number(id), nome, ativa: false }, repetido: true }
        : { conflito: true };
    }

    const { rows: [academia] } = await client.query(`
      INSERT INTO academias (nome, ativo) VALUES ($1, 0)
      RETURNING id, nome, (ativo = 1) AS ativa
    `, [nome]);
    await auditar(`${prefixoOperacao}${resumo}:${academia.id}`, sessao.proprietario_id, client);
    return { academia };
  });
}

async function listarAuditoria({ limite, offset }) {
  const { rows } = await consulta(`
    SELECT id, evento, criado_em
    FROM super_admin_auditoria
    ORDER BY id DESC
    LIMIT $1 OFFSET $2
  `, [limite, offset]);
  return rows.map((row) => {
    const cadastro = /^academia_criada:[a-f0-9]{64}:[a-f0-9]{64}:(\d+)$/.exec(row.evento);
    const convite = /^(convite_(?:emitido|reemitido|revogado|ocultado|aceito|conta_criada|aceitacao_recusada)):(\d+):(\d+)(?::(\d+))?$/.exec(row.evento);
    if (convite) return { ...row, evento: convite[1], academia_id: Number(convite[2]),
      convite_id: Number(convite[3]), ...(convite[4] && { usuario_id: Number(convite[4]) }) };
    const operacao = /^academia_operacao:(\d+):(\d+)$/.exec(row.evento);
    const gestao = /^(academia_(?:cadastro_consultado|editada|excluida|excluida_definitivamente)):(\d+)$/.exec(row.evento);
    if (gestao) return { ...row, evento: gestao[1], academia_id: Number(gestao[2]) };
    if (operacao) return { ...row, evento: 'academia_operacao', academia_id: Number(operacao[1]), historico_id: operacao[2] };
    const troca = /^comercial_troca_meio:(\d+):/.exec(row.evento);
    if (troca) return { ...row, evento:'comercial_troca_meio', academia_id:Number(troca[1]) };
    const comercial = /^(comercial_(?:assinatura|cortesia_concedida|cortesia_revogada|recebimento|asaas_reserva|asaas_cancelamento)):(\d+)(?::(\d+))?$/.exec(row.evento);
    if (comercial) return { ...row, evento: comercial[1], academia_id: Number(comercial[2]),
      ...(comercial[3] && { registro_id: Number(comercial[3]) }) };
    const preco = /^comercial_preco:(\d+)$/.exec(row.evento);
    if (preco) return { ...row, evento: 'comercial_preco', registro_id: Number(preco[1]) };
    const admin = /^(administrador_[a-z_]+):(\d+):(\d+)$/.exec(row.evento);
    if (admin) return { ...row, evento: admin[1], usuario_id: Number(admin[2]), academia_id: Number(admin[3]) };
    if (cadastro) return { ...row, evento: 'academia_criada', academia_id: Number(cadastro[1]) };
    return row.evento.startsWith(prefixoCadastro) ? { ...row, evento: 'academia_criada' } : row;
  });
}

module.exports = { consulta, transacao, auditar, criarProprietario, limitar, emitirSessao, marcarTotp, buscarSessao, indicadores, listarAcademias, obterCadastroAcademia, listarAdministradores, paginarRegistros, academiaExiste, listarAuditoria, criarAcademia, situacaoOperacional, autorizarOperacaoRecente };
