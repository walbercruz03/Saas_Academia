const base = '/api/super-admin';

export async function solicitar(acao, dados, signal, chave) {
  const resposta = await fetch(`${base}/${acao}`, {
    method: dados ? 'POST' : 'GET',
    ...(dados && { headers: { 'Content-Type': 'application/json', ...(chave && { 'Idempotency-Key': chave }) }, body: JSON.stringify(dados) }),
    signal,
    cache: 'no-store',
  });
  if (resposta.status === 204) return null;
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const erro = new Error(corpo?.mensagem || 'Não foi possível concluir a solicitação.');
    erro.status = resposta.status;
    throw erro;
  }
  return corpo;
}

