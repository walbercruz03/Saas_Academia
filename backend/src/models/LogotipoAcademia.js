const { consulta } = require('./SuperAdmin');

const limite = 128 * 1024;
const png = Buffer.from('89504e470d0a1a0a', 'hex');
const fimPng = Buffer.from('0000000049454e44ae426082', 'hex');

function formatoValido(mime, conteudo) {
  if (!Buffer.isBuffer(conteudo) || conteudo.length < 12 || conteudo.length > limite) return false;
  switch (mime) {
    case 'image/png':
      return conteudo.length >= 45 && conteudo.subarray(0, 8).equals(png) &&
        conteudo.readUInt32BE(8) === 13 && conteudo.toString('ascii', 12, 16) === 'IHDR' &&
        conteudo.subarray(-12).equals(fimPng);
    case 'image/jpeg':
      return conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo[2] === 0xff &&
        conteudo.at(-2) === 0xff && conteudo.at(-1) === 0xd9;
    case 'image/webp':
      return conteudo.length >= 20 && conteudo.toString('ascii', 0, 4) === 'RIFF' &&
        conteudo.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(conteudo.toString('ascii', 12, 16)) &&
        conteudo.readUInt32LE(4) + 8 === conteudo.length;
    default:
      return false;
  }
}

async function disponivel() {
  const { rows: [schema] } = await consulta("SELECT to_regclass('public.academia_logotipos') IS NOT NULL AS pronta");
  return schema.pronta;
}

async function buscar(id) {
  const { rows: [logotipo] } = await consulta('SELECT mime, conteudo FROM academia_logotipos WHERE academia_id=$1', [id]);
  return logotipo;
}

async function salvar(id, mime, conteudo) {
  const { rowCount } = await consulta(`
    INSERT INTO academia_logotipos (academia_id, mime, conteudo)
    SELECT id, $2, $3 FROM academias WHERE id=$1 AND excluida_em IS NULL
    ON CONFLICT (academia_id) DO UPDATE SET mime=EXCLUDED.mime, conteudo=EXCLUDED.conteudo
  `, [id, mime, conteudo]);
  return rowCount > 0;
}

module.exports = { buscar, disponivel, formatoValido, limite, salvar };
