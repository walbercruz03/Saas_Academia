const { createHash } = require('node:crypto');
const { consulta, transacao, auditar, situacaoOperacional, autorizarOperacaoRecente } = require('./SuperAdmin');

const transicoes = Object.freeze({
  ativar: 'aguardando_ativacao',
  suspender: 'ativa',
  reativar: 'suspensa',
  regularizar: 'inativa_indeterminada',
});

const campos = 'id, academia_id, proprietario_id, operacao, estado_anterior, estado_novo, motivo, criado_em, versao_anterior, versao_posterior';
const formatoBcrypt = /^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/.source;

async function alterar({ academiaId, tokenHash, operacao, motivo, chave, semTotpLocal }) {
  return transacao(async (client) => {
    const acesso = await autorizarOperacaoRecente(client, tokenHash, semTotpLocal);
    if (!acesso.sessao) return acesso;
    const proprietario = acesso.sessao.proprietario_id;
    const operacaoHash = createHash('sha256').update(chave).digest('hex');

    const { rows: [anterior] } = await client.query(`
      SELECT ${campos} FROM academias_historico_operacional
      WHERE proprietario_id = $1 AND operacao_hash = $2`, [proprietario, operacaoHash]);
    if (anterior) {
      return anterior.academia_id === academiaId && anterior.operacao === operacao && anterior.motivo === motivo
        ? { status: 200, evento: anterior, repetido: true }
        : { status: 409, codigo: 'CHAVE_REUTILIZADA' };
    }

    // O estado é lido em uma nova instrução após adquirir o bloqueio da academia.
    const bloqueio = await client.query('SELECT id FROM academias WHERE id = $1 FOR UPDATE', [academiaId]);
    if (!bloqueio.rowCount) return { status: 404 };
    const { rows: [academia] } = await client.query(`
      SELECT a.versao_sessao, ${situacaoOperacional} AS situacao
      FROM academias a WHERE a.id = $1`, [academiaId]);
    if (academia.situacao !== transicoes[operacao]) return { status: 409, codigo: 'TRANSICAO_INCOMPATIVEL' };

    const suspender = operacao === 'suspender';
    if (!suspender) {
      const administrador = await client.query(`
        SELECT id FROM usuarios
        WHERE academia_id = $1 AND cargo = 'admin' AND status = 'ativo' AND senha_hash ~ $2
        ORDER BY id LIMIT 1 FOR UPDATE`, [academiaId, formatoBcrypt]);
      if (!administrador.rowCount) return { status: 409, codigo: 'ADMINISTRADOR_NECESSARIO' };
    }

    const { rows: [alterada] } = await client.query(`
      UPDATE academias SET ativo = $2, versao_sessao = versao_sessao + $3
      WHERE id = $1 RETURNING versao_sessao`, [academiaId, suspender ? 0 : 1, suspender || operacao === 'regularizar' ? 1 : 0]);
    const { rows: [evento] } = await client.query(`
      INSERT INTO academias_historico_operacional
        (academia_id, proprietario_id, operacao, estado_anterior, estado_novo, motivo, operacao_hash,
         versao_anterior, versao_posterior)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING ${campos}`, [academiaId, proprietario, operacao, academia.situacao, suspender ? 'suspensa' : 'ativa',
      motivo, operacaoHash, academia.versao_sessao, alterada.versao_sessao]);
    await auditar(`academia_operacao:${academiaId}:${evento.id}`, proprietario, client);
    return { status: 200, evento, repetido: false };
  });
}

async function historico(academiaId, limite, offset) {
  const academia = await consulta('SELECT 1 FROM academias WHERE id = $1', [academiaId]);
  if (!academia.rowCount) return null;
  const { rows } = await consulta(`
    SELECT * FROM (
      SELECT ${campos}, 'operacional' AS origem FROM academias_historico_operacional WHERE academia_id=$1
      UNION ALL
      SELECT id, $1::integer, proprietario_id, split_part(evento,':',1), NULL, NULL, NULL, criado_em, NULL, NULL, 'auditoria'
      FROM super_admin_auditoria WHERE evento IN ('academia_editada:'||$1, 'academia_excluida:'||$1)
    ) historico ORDER BY criado_em DESC, origem, id DESC LIMIT $2 OFFSET $3`, [academiaId, limite, offset]);
  return rows;
}

module.exports = { alterar, historico, transicoes };
