const MINIMO_SENHA = 8;
const MAXIMO_BYTES = 72;
const MENSAGEM_SENHA = 'Use pelo menos 8 caracteres e até 72 bytes. Evite senhas comuns ou previsíveis.';
const comuns = new Set(['12345678','123456789','1234567890','87654321','11111111','qwerty','qwertyuiop',
  'password','senha','admin','administrador','wcfit','iloveyou','letmein','welcome','brasil','abcdef','football','sunshine',
  'p@ssw0rd','p@ssword','s3nha','qwerty123','abc123','password123','senha123','admin123']);
function senhaValida(senha) {
  if (typeof senha !== 'string' || [...senha].length < MINIMO_SENHA || Buffer.byteLength(senha) > MAXIMO_BYTES) return false;
  const simples = senha.normalize('NFKC').toLowerCase().trim();
  const base = simples.replace(/[0-9!@#$%*_.?+-]+$/g,'');
  return simples.length >= MINIMO_SENHA && !comuns.has(simples) && !comuns.has(base) &&
    !/^(\d+|(.{1,4})\2+)$/.test(simples);
}
module.exports = { MINIMO_SENHA, MAXIMO_BYTES, MENSAGEM_SENHA, senhaValida };
