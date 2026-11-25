const { createHash, randomUUID } = require('node:crypto');
const db = require('../config/database');

const resumir = (valor) => createHash('sha256').update(valor).digest();
const idValido = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
let implantado = false;
async function disponivel() {
  if (db.isSqlite) return false;
  if (!implantado) {
    const { rows:[result] } = await db.pool.query("SELECT to_regclass('public.usuario_sessoes') IS NOT NULL AS pronta");
    implantado = result.pronta;
  }
  return implantado;
}
async function emitir(usuario, senhaHash) {
  const jti = randomUUID();
  const { rowCount } = await db.pool.query(`
    INSERT INTO usuario_sessoes (usuario_id,token_hash,expira_em)
    SELECT id,$2,clock_timestamp()+interval '12 hours' FROM usuarios
    WHERE id=$1 AND senha_hash=$3 AND academia_id=$4 AND cargo=$5 AND status='ativo' AND excluido_em IS NULL
    FOR SHARE`,[usuario.id,resumir(jti),senhaHash,usuario.academia_id,usuario.cargo]);
  return rowCount ? jti : null;
}
async function valida(id,jti) {
  if (!idValido(jti)) return false;
  const { rowCount } = await db.pool.query(`
    SELECT 1 FROM usuario_sessoes WHERE usuario_id=$1 AND token_hash=$2
      AND revogada_em IS NULL AND expira_em>clock_timestamp()`,[id,resumir(jti)]);
  return rowCount > 0;
}
module.exports = { disponivel, emitir, valida, resumir };
