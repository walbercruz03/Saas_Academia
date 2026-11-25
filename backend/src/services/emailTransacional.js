async function enviarEmail({ apiKey, remetente, email, assunto, texto }) {
  if (!apiKey || !remetente) throw new Error('Entrega de e-mail indisponível.');
  const resposta = await fetch('https://api.resend.com/emails', {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(8000),
    headers:{ Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json' },
    body:JSON.stringify({ from:remetente,to:[email],subject:assunto,text:texto }),
  });
  await resposta.body?.cancel();
  if (!resposta.ok) throw new Error('Entrega de e-mail indisponível.');
}
module.exports = enviarEmail;
