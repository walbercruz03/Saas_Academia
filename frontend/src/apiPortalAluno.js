export const basePortal = '/api/aluno';
export const eventoFalhaPortal = 'wcfit:portal-conexao-indisponivel';

function falhaDeConexao() {
  window.dispatchEvent(new Event(eventoFalhaPortal));
  return new Error('Não foi possível confirmar a operação com o servidor.');
}

export async function requisitar(rota, { signal, corpo } = {}) {
  let resposta;
  try {
    resposta = await fetch(basePortal + rota, {
      signal, credentials: 'same-origin', cache: 'no-store',
      ...(corpo && { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(corpo) }),
    });
  } catch (erro) {
    if (signal?.aborted) throw erro;
    throw falhaDeConexao();
  }
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);
  if (signal?.aborted) throw signal.reason;
  if ([502,504].includes(resposta.status) || (resposta.status === 503 && !dados) || (resposta.ok && !dados)) {
    throw falhaDeConexao();
  }
  if (!resposta.ok) throw Object.assign(new Error(dados?.mensagem || 'O Portal do Aluno está indisponível.'), { status:resposta.status });
  return dados;
}
