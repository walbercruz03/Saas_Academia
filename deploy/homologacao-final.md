# Homologação final do WC Fit

O ambiente público de produção permanece fechado para cadastro e cobranças até a aprovação final. Use uma instância separada com PostgreSQL, usuários e documentos sintéticos para testar os provedores. Configure segredos em arquivo privado com permissão 0600 ou no cofre do host. Nenhum teste deve usar a chave Asaas de produção.

## Domínio, DNS e certificado

- Crie um registro A do domínio definitivo para o IPv4 público. Crie AAAA somente se o servidor responder publicamente em IPv6. Para um subdomínio atrás de um alvo fornecido pela hospedagem, use o CNAME indicado pelo provedor em vez de A/AAAA.
- Mantenha 80 e 443 disponíveis para HTTP-01 e HTTPS. Se a zona já restringir autoridades por CAA, confira se autoriza Let’s Encrypt. Verifique DNS e firewall antes da emissão.
- Inicialize só o bloco HTTP do modelo Nginx, com o domínio real, e crie o webroot `/var/www/wcfit-acme`. A rota do desafio deve responder diretamente.
- Emita com `certbot certonly --webroot -w /var/www/wcfit-acme -d DOMINIO --email EMAIL --agree-tos`. Depois habilite o bloco HTTPS, execute `nginx -t` e recarregue o serviço. Confirme redirecionamento, hostname e validade do certificado.
- Use a automação instalada pelo Certbot para `renew`. Configure um hook de deploy que rode `nginx -t && systemctl reload nginx`. Confira o agendamento do host e execute `certbot renew --dry-run`.

Referência: [Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html?highlight=renew).

## Resend

No painel, adicione o domínio remetente e replique os registros exibidos com os nomes, tipos e valores exatos. O envio usa os registros DKIM e SPF/retorno indicados, incluindo o MX de retorno quando solicitado. Preserve os registros atuais do domínio principal. Aguarde o status verificado e crie chave com permissão de envio restrita ao domínio. Configure `CADASTRO_EMAIL_API_KEY`, `CADASTRO_EMAIL_REMETENTE`, `GESTAO_EMAIL_API_KEY`, `GESTAO_EMAIL_REMETENTE` e a origem HTTPS dos links no ambiente de homologação.

Use uma caixa autorizada. Valide código de cadastro, confirmação de alteração de e-mail e redefinição de senha iniciadas pelo Super Admin. Confira entrega, origem do link, expiração e uso único. Registre resultados e IDs não sensíveis. Preserve códigos, links com tokens e chaves fora dos logs.

Referência: [Verificação de DNS no Resend](https://resend.com/changelog/domain-verification-events).

## Asaas Sandbox

Configure chave Sandbox, namespace, token do webhook e URL de retorno HTTPS terminada em `/configuracoes/assinatura`. Use `/api/asaas-sandbox/webhook` como destino e configure a autenticação pelo header `asaas-access-token`. Acompanhe eventos de checkout, exclusão de assinatura e pagamentos, incluindo confirmação, exclusão e estorno.

Na instância de homologação, confirme:

- Preço contratado de R$ 79,99, trial de 30 dias e nenhum débito antes do primeiro vencimento.
- Cartão no checkout hospedado e Pix convencional com pagamento de cada fatura.
- Cancelamento antes do fim do trial, ausência de cobrança após a confirmação e manutenção de acesso até o fim do período vigente.
- Pagamento e estorno sandbox refletidos na conciliação, com repetição e atraso de eventos.
- Troca de meio com encerramento da recorrência anterior, preservação do período pago e ausência de cobrança duplicada.
- Dados Sandbox separados dos recebimentos reais e do financeiro de alunos.

Referência: [Conta Sandbox](https://docs.asaas.com/docs/como-configurar-sua-conta-no-sandbox) e [webhooks](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook).

## Documentos e aceite

As minutas em `deploy/legal` são privadas e aguardam os dados do prestador e aprovação. Após aprovação e autorização de publicação, publique HTML definitivo em `/var/www/wcfit-legal/legal/AAAA-MM-DD/termos.html` e `privacidade.html`. Retire a indicação de minuta e marque a vigência. Versione cada revisão em um novo caminho e preserve os arquivos já aceitos.

Configure as URLs HTTPS desse mesmo domínio em `CADASTRO_TERMOS_URL` e `CADASTRO_PRIVACIDADE_URL`. Depois de conferir os dois HTTP 200, habilite `LEGAL_DOCUMENTOS_APROVADOS` no perfil de produção. O login consulta os links independentemente da liberação do cadastro. O cadastro registra as duas URLs versionadas e o instante da confirmação de e-mail na mesma inserção transacional. Considere esse instante a data do aceite somente para os documentos cujas URLs estão gravadas. Preserve o histórico anterior sem preencher datas ou versões retroativas.

## Antes de liberar

Valide cookies de sessão do Super Admin, TOTP, CORS, permissões e isolamento com contas sintéticas. Configure alertas de prontidão, 5xx, disco, validade TLS, reinícios e atraso de backup. Agende backup diário com cópia cifrada em destino privado, alerta após 26 horas e ensaio periódico de restauração. Use o procedimento de backup e rollback do README.

Conclua a jornada real em homologação e solicite autorização separada antes de abrir cadastro ou cobranças reais. O perfil de produção mantém esses recursos fechados.
