# Homologação temporária do WC Fit

O projeto Docker `wcfit-homologacao` usa um PostgreSQL novo em memória, sem porta publicada e sem montar o volume principal. Restaure somente a estrutura de um backup verificado com `pg_restore --schema-only --no-owner --no-privileges`. Complete as migrations faltantes nesse banco e inicialize apenas os metadados de migração e o preço de teste. Não importe linhas do backup. Use academias, documentos, cartões e pagamentos fictícios. O Super Admin e os endpoints de convites ficam bloqueados no proxy público.

## Quick Tunnel

Use a imagem oficial `cloudflare/cloudflared` na rede de entrada `wcfit-homologacao_ingress` com `tunnel --no-autoupdate --url http://frontend:80`. A URL HTTPS liga somente ao Nginx da homologação. O hostname é temporário e muda quando o túnel é reiniciado. Use o mesmo endereço como `HOMOLOG_ORIGEM` para o CORS e o retorno do Checkout. O webhook é `/api/asaas-sandbox/webhook`, protegido pelo token compartilhado do Asaas. O bloqueio interativo por e-mail do Quick Tunnel impediria o webhook, por isso o cadastro do WC Fit limita o envio e a confirmação à caixa autorizada.

## Configurações externas

- **Resend gratuito**. Forneça uma chave de envio e o mesmo e-mail usado na conta Resend em `CADASTRO_EMAIL_DESTINO_TESTE`. O remetente é `onboarding@resend.dev`. Esse remetente não permite testar entrega a destinatários arbitrários. Ative `CADASTRO_PUBLICO_ATIVO=true` somente no arquivo privado da homologação após o provisionamento.
- **Asaas Sandbox**. Forneça somente uma chave Sandbox em `ASAAS_SANDBOX_API_KEY`, entre aspas simples no arquivo privado para que o Compose preserve o cifrão literal. Cadastre no painel Sandbox o webhook na URL HTTPS temporária com o token de `ASAAS_SANDBOX_WEBHOOK_TOKEN`, entregue no header `asaas-access-token`. Selecione eventos de checkout, assinatura e pagamentos/estornos. Ative `ASAAS_SANDBOX_ATIVO=true` somente na homologação, com o namespace e a origem definidos.

Use `.env.homologacao.local`, com modo 0600 e ignorado pelo Git. O arquivo privado efêmero usado pelo Compose precisa receber as configurações de provedores antes de recriar apenas o backend dessa homologação. Não imprima o arquivo nem o resultado expandido do Compose. O banco em memória é perdido se o serviço PostgreSQL for parado ou recriado.

## Depois, com domínio próprio

Troque a origem e as URLs de retorno, webhook e documentos para o novo hostname. Verifique o remetente no domínio definitivo, emita o certificado e use o perfil de produção conforme [o roteiro de implantação](homologacao-final.md). As minutas em `deploy/legal` aguardam identificação jurídica, prazos e aprovação antes de serem tratadas como documentos oficiais.

## Registro da homologação

- 25/11/2026 — Resend homologado para a caixa autorizada. Recebimento confirmado pelo titular. Cadastro, confirmação de alteração de e-mail, recuperação, uso único e invalidação de sessão foram validados com conta sintética.
- 25/11/2026 — Asaas Sandbox autenticado. Webhook criado pela API na URL temporária, com API v3, envio sequencial, ativo e sem interrupção. Eventos configurados: `CHECKOUT_CREATED`, `CHECKOUT_PAID`, `CHECKOUT_CANCELED`, `CHECKOUT_EXPIRED`, `SUBSCRIPTION_DELETED`, `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED` e `PAYMENT_REFUND_IN_PROGRESS`.
- 25/11/2026 — Sem faturas durante o trial no teste Pix e na criação do checkout de cartão. O avanço de data ocorreu só no banco descartável. O reenvio deixou uma assinatura e uma fatura. Cancelamento pré-trial deixou zero cobranças e preservou o acesso programado. Pagamento de cartão de teste e estorno foram conciliados pelo webhook real.
- 25/11/2026 — Pix específico pendente porque a chave da conta está em `AWAITING_ACTIVATION` e a cobrança resultante voltou como boleto. O checkout hospedado também exige validação humana. A chave de API Sandbox usada neste ensaio deve ser rotacionada.
