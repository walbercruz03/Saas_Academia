const { createHash, createHmac, timingSafeEqual } = require('node:crypto');
const db = require('../config/database');

function erroOperacao(status, mensagem, codigo) {
  return Object.assign(new Error(mensagem), { status, codigo });
}

function configuracao() {
  const indisponivel = () => erroOperacao(503, 'Proteção de reenvio indisponível.');
  const ativa = process.env.IDEMPOTENCIA_HMAC_VERSAO;
  let valores;
  try {
    const objeto = JSON.parse(process.env.IDEMPOTENCIA_HMAC_CHAVES || 'null');
    if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) throw indisponivel();
    valores = Object.entries(objeto);
  } catch {
    throw indisponivel();
  }
  const chaves = new Map();
  for (const [versao, chave] of valores) {
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(versao) || typeof chave !== 'string' ||
        !/^[0-9a-f]{64}$/i.test(chave) ||
        [process.env.JWT_SECRET, process.env.SUPER_ADMIN_TOTP_KEY].some(
          (segredo) => segredo?.toLowerCase() === chave.toLowerCase()
        )) throw indisponivel();
    chaves.set(versao, Buffer.from(chave, 'hex'));
  }
  if (!chaves.has(ativa)) throw indisponivel();
  return { ativa, chaves };
}

async function executar(req, tipo, parametros, gravar) {
  const chave = req.get('Idempotency-Key');
  if (!/^[A-Za-z0-9_-]{22,128}$/.test(chave || '')) {
    throw erroOperacao(400, 'Chave de reenvio inválida.');
  }
  if (db.isSqlite && db.pool) throw erroOperacao(503, 'PostgreSQL indisponível.');
  if (db.isSqlite) {
    throw erroOperacao(501, 'Proteção de reenvio indisponível no SQLite.', 'IDEMPOTENCIA_SQLITE');
  }

  const { id, academia_id, cargo } = req.usuario;
  const versaoSessao = req.versaoSessaoValidada;
  const hash = createHash('sha256').update(chave).digest();
  const escopo = [academia_id, id, tipo, hash];
  const { ativa, chaves } = configuracao();
  const hmac = (versao) => {
    if (!chaves.has(versao)) throw erroOperacao(503, 'Proteção de reenvio indisponível.');
    return createHmac('sha256', chaves.get(versao))
      .update(JSON.stringify([academia_id, id, tipo, parametros])).digest();
  };
  const cliente = await db.pool.connect();
  let descartar = false;
  try {
    await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    // Usa a mesma ordem de bloqueios da operação de ativação e suspensão.
    const { rows: [academia] } = await cliente.query(
      'SELECT ativo, versao_sessao::text AS versao FROM academias WHERE id = $1 FOR SHARE', [academia_id]);
    if (academia?.ativo !== 1) throw erroOperacao(403, 'Sessão sem acesso à academia.');
    if (academia.versao !== versaoSessao) throw erroOperacao(401, 'Sessão invalidada. Entre novamente.');
    const { rowCount: autorizado } = await cliente.query(`
      SELECT id FROM usuarios WHERE id = $1 AND academia_id = $2 AND status = 'ativo' AND cargo = $3 FOR SHARE
    `, [id, academia_id, cargo]);
    if (!autorizado) throw erroOperacao(403, 'Sessão sem acesso à academia.');

    // Serializa somente o escopo desta chave. O índice único também protege o recibo.
    await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [JSON.stringify([academia_id, id, tipo, hash.toString('hex')])]);
    const { rows: [anterior] } = await cliente.query(`
      SELECT parametros_versao, parametros_hmac, status_http, recibo
      FROM operacoes_idempotentes
      WHERE academia_id = $1 AND solicitante_id = $2 AND tipo_operacao = $3 AND chave_hash = $4
    `, escopo);
    if (anterior) {
      if (!timingSafeEqual(anterior.parametros_hmac, hmac(anterior.parametros_versao))) {
        throw erroOperacao(409, 'A chave já está associada a outra operação.', 'IDEMPOTENCIA_CONFLITO');
      }
      await cliente.query('COMMIT');
      return { status: anterior.status_http, recibo: anterior.recibo, repetido: true };
    }

    const resultado = await gravar(db.executorPostgres(cliente));
    const recibo = { id: resultado.id };
    await cliente.query(`
      INSERT INTO operacoes_idempotentes (academia_id, solicitante_id, tipo_operacao, chave_hash,
        parametros_versao, parametros_hmac, resultado_tipo, resultado_id, status_http, recibo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,201,$9)
    `, [...escopo, ativa, hmac(ativa), tipo === 'registrar_checkin' ? 'checkin' : 'matricula', resultado.id, recibo]);
    await cliente.query('COMMIT');
    return { status: 201, recibo, repetido: false };
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK');
    } catch {
      descartar = true;
    }
    throw erro;
  } finally {
    cliente.release(descartar);
  }
}

function responder(res, erro, mensagem) {
  const status = erro.status || (erro.code === '42P01' ? 503 : 500);
  return res.status(status).json({ mensagem: erro.status ? erro.message : mensagem, codigo: erro.codigo });
}

function canonizarId(id) {
  return typeof id === 'number' ? String(id) : id;
}

module.exports = { executar, erroOperacao, responder, canonizarId };
