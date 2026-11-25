const { randomBytes, scrypt, timingSafeEqual, createHash, createCipheriv, createDecipheriv } = require('node:crypto');
const derivar = require('node:util').promisify(scrypt);

const emailNormalizado = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
const { MINIMO_SENHA, senhaValida } = require('./politicaSenha');

async function hashSenha(senha, sal = randomBytes(16).toString('hex')) {
  const hash = await derivar(senha, sal, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return `${sal}:${hash.toString('hex')}`;
}

async function conferirSenha(senha, armazenada) {
  if (typeof senha !== 'string' || Buffer.byteLength(senha) > 1024) return false;
  // O custo da verificação também é aplicado para uma identidade inexistente.
  const referencia = armazenada || `${'0'.repeat(32)}:${'0'.repeat(128)}`;
  const [sal] = referencia.split(':');
  const candidato = await hashSenha(senha, sal);
  return timingSafeEqual(Buffer.from(candidato), Buffer.from(referencia)) && Boolean(armazenada);
}

const hash = (finalidade, valor) => createHash('sha256').update(finalidade).update('\0').update(valor).digest('hex');
const emitirToken = () => `wcfit_sa_${randomBytes(32).toString('base64url')}`;
const hashSessao = (token) => /^wcfit_sa_[A-Za-z0-9_-]{43}$/.test(token || '') ? hash('sessao', token) : null;
const codigosRecuperacao = () => Array.from({ length: 8 }, () => randomBytes(16).toString('hex'));
const hashRecuperacao = (codigo) => typeof codigo === 'string' && /^[a-f0-9]{32}$/i.test(codigo)
  ? hash('recuperacao', codigo.toLowerCase()) : null;

function chave() {
  const valor = process.env.SUPER_ADMIN_TOTP_KEY;
  if (!/^[a-f0-9]{64}$/i.test(valor || '') || new Set(valor.toLowerCase()).size < 12) {
    const erro = new Error('Segundo fator administrativo indisponível.');
    erro.status = 503;
    throw erro;
  }
  return Buffer.from(valor, 'hex');
}

function cifrar(segredo) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave(), iv);
  const valor = Buffer.concat([cipher.update(segredo, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), valor].map((parte) => parte.toString('base64url')).join('.');
}

function decifrar(texto) {
  const [iv, tag, valor] = texto.split('.').map((parte) => Buffer.from(parte, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(valor), decipher.final()]).toString('utf8');
}

async function obterTotp() {
  try {
    return await import('otplib');
  } catch {
    const erro = new Error('Segundo fator administrativo indisponível.');
    erro.status = 503;
    throw erro;
  }
}

async function prepararTotp() {
  chave();
  return obterTotp();
}

async function conferirTotp(segredo, codigo, agora = Date.now()) {
  if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) return null;
  const totp = await obterTotp();
  const atual = Math.floor(agora / 30000);
  for (const passo of [atual, atual - 1, atual + 1]) {
    const resultado = await totp.verify({ secret: segredo, token: codigo, epoch: passo * 30, epochTolerance: 0 });
    if (resultado.valid) return passo;
  }
  return null;
}

module.exports = { MINIMO_SENHA, emailNormalizado, senhaValida, hashSenha, conferirSenha, emitirToken, hashSessao,
  codigosRecuperacao, hashRecuperacao, cifrar, decifrar, obterTotp, prepararTotp, conferirTotp };
