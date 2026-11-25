function logFalha(contexto, erro) {
  const codigo = typeof erro?.code === 'string' &&
    /^(?:[0-9A-Z]{5}|SQLITE_[A-Z_]+|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)$/.test(erro.code)
    ? erro.code : 'INTERNO';
  console.error(contexto, codigo);
}

module.exports = logFalha;
