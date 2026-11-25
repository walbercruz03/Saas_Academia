const documento = (valor, nome, origem) => {
  try {
    const url = new URL(valor);
    if (url.origin !== origem || url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash) return null;
    return new RegExp(`^/legal/[0-9]{4}-[0-9]{2}-[0-9]{2}(?:-[a-z0-9]+)?/${nome}\\.html$`).test(url.pathname)
      ? url.href : null;
  } catch {
    return null;
  }
};

function aprovados(env = process.env) {
  if (env.LEGAL_DOCUMENTOS_APROVADOS !== 'true') return null;
  const origem = env.APP_CORS_ORIGIN;
  const termos_url = documento(env.CADASTRO_TERMOS_URL, 'termos', origem);
  const privacidade_url = documento(env.CADASTRO_PRIVACIDADE_URL, 'privacidade', origem);
  return termos_url && privacidade_url ? { termos_url, privacidade_url } : null;
}

module.exports = { aprovados };
