const { randomBytes, createHash } = require('node:crypto');
const { paginarRegistros, transacao, autorizarOperacaoRecente, auditar, situacaoOperacional } = require('./SuperAdmin');

const resumir = (valor) => createHash('sha256').update(valor).digest('hex');

const evento = (tipo, convite) => `${tipo}:${convite.academia_id}:${convite.id}`;

const eventoOcultado = "concat('convite_ocultado:', c.academia_id, ':', c.id)";
const visivel = `NOT EXISTS (SELECT 1 FROM super_admin_auditoria a WHERE a.evento = ${eventoOcultado})`;
const finalizado = '(c.consumido_em IS NOT NULL OR c.revogado_em IS NOT NULL OR c.expira_em <= statement_timestamp())';

async function emitir({ tokenHash, academiaId, nome, email, chave, semTotpLocal }) {
  return transacao(async (client) => {
    const acesso = await autorizarOperacaoRecente(client, tokenHash, semTotpLocal);
    if (!acesso.sessao) return acesso;
    const emissor = acesso.sessao.proprietario_id;
    return emitirComSessao(client, { academiaId, nome, email, chave, emissor });
  });
}

async function emitirComSessao(client, { academiaId, nome, email, chave, emissor }) {
  const operacao = resumir(chave);
  const { rows: [anterior] } = await client.query(`
    SELECT id, academia_id, nome, email, expira_em FROM super_admin_convites
    WHERE emissor_id = $1 AND operacao_hash = $2`, [emissor, operacao]);
  if (anterior) {
    if (anterior.academia_id !== academiaId || anterior.nome !== nome || anterior.email !== email) return { status: 409 };
    return { status: 200, id: anterior.id, expiraEm: anterior.expira_em };
  }
  const academia = await client.query(`SELECT a.id FROM academias a WHERE a.id = $1 AND to_jsonb(a)->>'excluida_em' IS NULL FOR KEY SHARE`, [academiaId]);
  if (!academia.rowCount) return { status: 404 };
  const conta = await client.query('SELECT 1 FROM usuarios WHERE lower(email_ou_matricula) = $1 LIMIT 1', [email]);
  if (conta.rowCount) return { status: 409 };

  const historico = await client.query('SELECT 1 FROM super_admin_convites WHERE email = $1 LIMIT 1', [email]);
  const { rows: revogados } = await client.query(`
    UPDATE super_admin_convites SET revogado_em = clock_timestamp()
    WHERE email = $1 AND revogado_em IS NULL AND consumido_em IS NULL
    RETURNING id, academia_id`, [email]);
  for (const anterior of revogados) await auditar(evento('convite_revogado', anterior), emissor, client);
  const token = randomBytes(32).toString('base64url');
  const { rows: [convite] } = await client.query(`
    INSERT INTO super_admin_convites (academia_id,nome,email,token_hash,emissor_id,operacao_hash)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,academia_id,expira_em`,
  [academiaId, nome, email, resumir(token), emissor, operacao]);
  await auditar(evento(historico.rowCount ? 'convite_reemitido' : 'convite_emitido', convite), emissor, client);
  return { status: 201, id: convite.id, expiraEm: convite.expira_em, token };
}

async function revogar(id, tokenHash, semTotpLocal) {
  return transacao(async (client) => {
    const acesso = await autorizarOperacaoRecente(client, tokenHash, semTotpLocal);
    if (!acesso.sessao) return acesso;
    const { rows: [atual] } = await client.query(`
      SELECT id, academia_id, consumido_em, revogado_em FROM super_admin_convites c
      WHERE id = $1 AND ${visivel} FOR UPDATE`, [id]);
    if (!atual) return { status: 404 };
    if (atual.consumido_em) return { status: 409 };
    if (!atual.revogado_em) {
      await client.query('UPDATE super_admin_convites SET revogado_em = clock_timestamp() WHERE id = $1', [id]);
      await auditar(evento('convite_revogado', atual), acesso.sessao.proprietario_id, client);
    }
    return { status: 204 };
  });
}

async function listar({ academiaId, pagina }) {
  return paginarRegistros(`
    SELECT c.id, c.nome, c.email, c.academia_id, a.nome AS academia_nome, c.expira_em,
      CASE WHEN c.consumido_em IS NOT NULL THEN 'utilizado'
        WHEN c.revogado_em IS NOT NULL THEN 'revogado'
        WHEN c.expira_em <= statement_timestamp() THEN 'expirado' ELSE 'pendente' END AS situacao
    FROM super_admin_convites c JOIN academias a ON a.id = c.academia_id
    WHERE ($1::integer IS NULL OR c.academia_id = $1)
      AND ${visivel}
  `, 'f.id DESC', [academiaId], pagina,
  ", count(*) FILTER (WHERE situacao <> 'pendente')::integer AS finalizados");
}

async function ocultarFinalizados({ id, academiaId, tokenHash, semTotpLocal }) {
  return transacao(async (client) => {
    const acesso = await autorizarOperacaoRecente(client, tokenHash, semTotpLocal);
    if (!acesso.sessao) return acesso;
    if (id) {
      const { rows: [convite] } = await client.query(`
        SELECT ${finalizado} AS finalizado FROM super_admin_convites c WHERE id = $1 FOR UPDATE`, [id]);
      if (!convite) return { status: 404 };
      if (!convite.finalizado) return { status: 409 };
    }
    // Preserva o vínculo com o administrador e a reserva da chave de idempotência.
    const { rowCount } = await client.query(`
      INSERT INTO super_admin_auditoria (evento, proprietario_id)
      SELECT ${eventoOcultado}, $3 FROM super_admin_convites c
      WHERE ($1::integer IS NULL OR c.id = $1) AND ($2::integer IS NULL OR c.academia_id = $2)
        AND ${finalizado} AND ${visivel}
    `, [id, academiaId, acesso.sessao.proprietario_id]);
    return { status: 200, removidos: rowCount };
  });
}

async function aceitar(token, senhaHash) {
  return transacao(async (client) => {
    // Mesma ordem de bloqueio das operações do proprietário.
    await client.query('SELECT id FROM super_admin_identidade WHERE id = 1 FOR UPDATE');
    const { rows: [convite] } = await client.query(`
      SELECT id, academia_id, nome, email, emissor_id FROM super_admin_convites
      WHERE token_hash = $1 AND revogado_em IS NULL AND consumido_em IS NULL
      FOR UPDATE`, [resumir(token)]);
    if (!convite) {
      await auditar('convite_aceitacao_recusada', null, client);
      return false;
    }

    const { rows: [academia] } = await client.query(`
      SELECT a.ativo, a.email, a.versao_sessao, to_jsonb(a)->>'ativar_apos_convite' = 'true' AS ativar,
        ${situacaoOperacional} AS situacao
      FROM academias a WHERE a.id = $1 AND to_jsonb(a)->>'excluida_em' IS NULL FOR UPDATE`, [convite.academia_id]);
    if (!academia) return false;
    // Preserva também a comparação sem distinção de caixa durante escritas legadas em usuarios.
    await client.query('LOCK TABLE usuarios IN SHARE ROW EXCLUSIVE MODE');
    const existente = await client.query('SELECT 1 FROM usuarios WHERE lower(email_ou_matricula) = $1 LIMIT 1', [convite.email]);
    if (existente.rowCount) {
      await auditar(evento('convite_aceitacao_recusada', convite), null, client);
      return false;
    }
    const { rows: [usuario] } = await client.query(`
      INSERT INTO usuarios (nome,email_ou_matricula,senha_hash,cargo,academia_id,telefone)
      SELECT $1,$2,$3,'admin',a.id,CASE WHEN a.email = $2 THEN to_jsonb(a)->>'responsavel_telefone' END
      FROM academias a WHERE a.id = $4 RETURNING id`, [convite.nome, convite.email, senhaHash, convite.academia_id]);
    const consumo = await client.query(`
      UPDATE super_admin_convites SET consumido_em = clock_timestamp(), usuario_id = $2
      WHERE id = $1 AND expira_em > clock_timestamp()`, [convite.id, usuario.id]);
    if (!consumo.rowCount) throw Object.assign(new Error('Convite expirado'), { code: 'CONVITE_EXPIRADO' });
    if (academia.ativar && academia.email === convite.email && academia.situacao === 'aguardando_ativacao') {
      await client.query('UPDATE academias SET ativo = 1, ativar_apos_convite = false WHERE id = $1', [convite.academia_id]);
      const { rows: [ativacao] } = await client.query(`
        INSERT INTO academias_historico_operacional
          (academia_id, proprietario_id, operacao, estado_anterior, estado_novo, operacao_hash, versao_anterior, versao_posterior)
        VALUES ($1,$2,'ativar','aguardando_ativacao','ativa',$3,$4,$4) RETURNING id`,
      [convite.academia_id, convite.emissor_id, resumir(`ativacao-convite:${convite.id}`), academia.versao_sessao]);
      await auditar(`academia_operacao:${convite.academia_id}:${ativacao.id}`, convite.emissor_id, client);
    }
    await auditar(evento('convite_aceito', convite), null, client);
    await auditar(`${evento('convite_conta_criada', convite)}:${usuario.id}`, null, client);
    return true;
  });
}

module.exports = { emitir, emitirComSessao, listar, revogar, ocultarFinalizados, aceitar };
