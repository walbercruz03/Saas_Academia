cruz@cruz-22V280-L-BY31P1:~/meu_saas$ docker compose exec backend node utils/criarSuperAdmin.js
## Desempenho e dependências do backend

A migration 013 adiciona índices de consulta por academia a check-ins,
alunos e matrículas. Os scripts de aplicação e reversão usam `CONCURRENTLY`
e devem ser executados fora de uma transação.

O histórico de check-ins e a listagem do financeiro aceitam `pagina` com
50 registros por página. No financeiro, os totais abrangem todo o período
filtrado. As chamadas sem `pagina` continuam retornando a lista padrão.

O perfil de produção usa PostgreSQL e instala o backend com `npm ci --omit=dev`.
O SQLite continua disponível no desenvolvimento com a instalação que inclui
as dependências de desenvolvimento.

## Procedimento de lançamento

### Banco, backup e restauração

O catálogo do PostgreSQL local confirmou as migrations JavaScript 001–004 e
as estruturas SQL 005–007. As migrations SQL 008–013 estão pendentes. O
runner executa as migrations JavaScript. Aplique os arquivos SQL por versão,
após verificar o catálogo e registrar o resultado de cada aplicação.

Gere o backup em diretório privado, fora do Git, antes de cada liberação.
O script usa `pg_dump -Fc`, inspeciona o arquivo e registra SHA-256.

```sh
bash deploy/backup-wcfit.sh /caminho/privado/de/backups wcfit-postgres
```

Para restaurar, verifique o SHA-256 e use um PostgreSQL 16 descartável,
com banco vazio, funções/roles necessárias e sem volume do banco principal.
A restauração fica em uma transação e interrompe ao primeiro erro.

```sh
(cd "$DIRETORIO_BACKUP" && sha256sum -c wcfit.dump.sha256)
docker exec -i "$PG_CONT_ENSAIO" pg_restore --exit-on-error --single-transaction \
  -U wcfit_admin -d wcfit_teste < "$DIRETORIO_BACKUP/wcfit.dump"

for arquivo in backend/src/migrations/00[89]*.up.sql backend/src/migrations/01[0-3]*.up.sql; do
  docker exec -i "$PG_CONT_ENSAIO" psql -X -v ON_ERROR_STOP=1 \
    -U wcfit_admin -d wcfit_teste < "$arquivo" || exit 1
done
```

Esse intervalo pressupõe a restauração de um backup com 005–007 já
presentes. A 013 usa índices concorrentes e precisa rodar fora de uma
transação. Verifique `pg_index.indisvalid` para os três índices após a
aplicação. Se um build concorrente falhar, identifique o índice inválido
antes de recuperar o passo. Pare diante de uma migration parcialmente
aplicada e compare o catálogo com seu arquivo, sem reexecutar toda a série.

Para automatizar, proponha backup diário, cópia cifrada fora do host,
alerta quando o último backup ultrapassar 26 horas e ensaio mensal de
restauração. Defina a retenção, a janela de recuperação e os responsáveis
antes do lançamento. A verificação do checksum complementa o ensaio de
restauração. Guarde as chaves JWT, TOTP e HMAC em cofre com acesso restrito
e recuperação independente do dump. Preserve versões HMAC usadas por
recibos existentes e a chave TOTP que cifra as contas já configuradas.

### Produção e monitoramento

Use Compose 2.24.4 ou superior. Copie
[`deploy/production.env.example`](deploy/production.env.example) para
`.env.producao.local`, com permissões `0600`. Defina domínio, release,
credenciais do PostgreSQL e segredos distintos para JWT, TOTP e HMAC.
Em banco existente, use as credenciais autorizadas e as chaves vigentes.
Use senha compatível com URL PostgreSQL ou configure a URL autenticada com
o escape apropriado, se necessário. Mantenha os segredos fora de logs,
artefatos de frontend, backup de configuração em claro e saída de
`docker compose config`.

O overlay força TOTP no Super Admin, fixa CORS no domínio HTTPS e deixa
banco e backend sem portas publicadas. O frontend escuta no loopback
`127.0.0.1:8080`. O cadastro público e o Asaas Sandbox ficam desativados
no perfil de produção. O cookie do Super Admin usa `Secure`, `HttpOnly`
e `SameSite=Strict`. Valide a configuração sem imprimir os segredos.

```sh
docker compose --env-file .env.producao.local \
  -f docker-compose.yml -f docker-compose.production.yml config --quiet
```

Aponte o DNS para o host, configure certificados para o domínio e use o
[modelo Nginx de borda](deploy/wcfit-nginx.conf.example). Valide a
configuração antes de recarregar, confirme o certificado no domínio e
teste a renovação. Mantenha somente 80/443 públicos. Restrinja SSH e Docker
a operadores autorizados. O log de acesso interno omite caminho e query
string, inclusive CPF. Registre e monitore disponibilidade, latência,
5xx, reinícios, saturação do pool/CPU, disco, validade TLS e idade do backup.
Use `/api/health` para processo ativo e `/api/ready` para acesso ao banco.

### Implantação e rollback

1. Prepare e teste imagens identificadas por release. Registre as imagens
   atuais, o estado do catálogo, o horário do backup e a janela aprovada.
2. Na janela autorizada, suspenda gravações, gere um backup final,
   verifique o destino e aplique somente as migrations pendentes por ordem.
   Confira catálogo, índices válidos e prontidão antes de liberar tráfego.
3. Suba as imagens da release com o overlay. Valide HTTPS, CORS, TOTP,
   login, isolamento, matrícula/check-in com reenvio, financeiro, relatório
   e assinaturas. Mantenha as funcionalidades externas fechadas.
4. Em falha, retome o modo de manutenção e preserve o banco atual. Reverta
   as imagens se a versão anterior for compatível com o schema atualizado.
   As migrations de dados têm proteção contra reversão com histórico em
   uso. Se a restauração for necessária, faça-a em um volume novo,
   verifique o conteúdo, reconcilie gravações posteriores ao backup e
   só então autorize o redirecionamento. Preserve o volume anterior.

Após a aprovação da janela, prepare as imagens no ambiente de destino
com `build backend frontend`. No momento de subir a release já preparada,
use a mesma configuração e evite reconstruir ou buscar imagens durante
a troca.

```sh
docker compose --env-file .env.producao.local \
  -f docker-compose.yml -f docker-compose.production.yml up -d --no-build --pull never
curl --fail --silent "https://SEU_DOMINIO/api/ready"
```

No rollback de aplicação, selecione a tag anterior preservada em
`WCFIT_RELEASE`, confira se as imagens estão disponíveis localmente e
repita o comando de subida após verificar a compatibilidade de schema.

### Homologação externa e privacidade

Resend em homologação precisa de domínio/remetente verificado, registros
DNS indicados pelo painel, chave de envio restrita e caixa de teste
controlada. Configure as variáveis nesse ambiente separado. Teste entrega
real, expiração e uso único, sem registrar códigos ou credenciais.
[Resend](https://resend.com/docs/dashboard/domains/introduction)

Asaas exige conta e chave Sandbox, namespace exclusivo e token independente
de webhook. Configure uma URL HTTPS de homologação para
`/api/asaas-sandbox/webhook`, habilite eventos `PAYMENT_*` e
`SUBSCRIPTION_DELETED` e use academias e documentos sintéticos. Valide
recorrência, Pix, boleto, cartão na fatura hospedada, reentrega, cancelamento
e estorno. [Asaas Sandbox](https://docs.asaas.com/docs/sandbox)

Antes do lançamento comercial, revise e publique os Termos de Uso e a
Política de Privacidade em URLs HTTPS versionadas. Defina responsáveis e
bases legais por finalidade, retenção e descarte, canal de atendimento ao
titular, prestadores e resposta a incidentes. Revise em especial a
necessidade e o acesso a CPF, fotos e anamnese, que pode conter dados
sensíveis de saúde. Valide os papéis da plataforma e das academias, os
avisos e contratos, e configure `CADASTRO_TERMOS_URL` e
`CADASTRO_PRIVACIDADE_URL` antes de autorizar o cadastro público.
[LGPD](https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) ·
[Guia de segurança da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/processo-guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf) ·
[Incidentes de segurança](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)

### Gerenciamento de administradores

A migration 014 deve ser implantada com o backend atualizado, mantendo o
tráfego suspenso durante a troca. A aplicação invalida JWTs legados e a
migration encerra as sessões antigas do Super Admin. Todos precisarão
entrar novamente. O Super Admin exige TOTP no login e nas ações sensíveis
quando a última confirmação tiver mais de cinco minutos.

A alteração de e-mail e a redefinição de senha usam links individuais de
uso único, válidos por 30 minutos. Configure `GESTAO_EMAIL_API_KEY`,
`GESTAO_EMAIL_REMETENTE` e a origem de links já usada pelos convites. As
credenciais do Resend desses fluxos são independentes do cadastro público.
A reversão automática da 014 foi bloqueada para preservar a exclusão lógica
e evitar que sessões antigas voltem a ser aceitas.
