# WC FIT — EVOLUÇÃO VISUAL, COMERCIAL E PORTAL DO ALUNO

Continue o projeto existente, reutilizando componentes, APIs, estilos e regras de negócio. Preserve a identidade visual e utilize a marca “Wc Fit”.

Os ícones Lucide React dos menus já foram implementados. Não refaça essa etapa.

## ETAPA 1 — Padronização visual e responsividade

- Padronizar fontes, espaçamentos, cores, botões, formulários, tabelas, cartões, títulos e alinhamentos.
- Corrigir conflitos entre CSS global e estilos específicos.
- Melhorar especialmente a organização da tela de treinos e das configurações.
- Garantir responsividade em computadores, tablets e celulares, incluindo sidebar recolhível, menus e formulários.
- Preservar os temas claro e escuro.
- Padronizar os ícones das ações internas utilizando Lucide React.
- Criar estilos reutilizáveis, evitando duplicações.

## ETAPA 2 — Página comercial

Criar landing page pública profissional e responsiva contendo:

- Apresentação do Wc Fit.
- Benefícios e funcionalidades.
- Demonstrações reais do sistema, sem informações pessoais.
- Plano de R$ 79,99 mensais, com 30 dias grátis.
- Botões “Começar 30 dias grátis”, “Cadastrar minha academia” e “Entrar”.
- Perguntas frequentes.
- Contato, Termos de Uso e Política de Privacidade, respeitando a aprovação das minutas.
- SEO básico e compartilhamento em redes sociais.

Reutilizar o cadastro público existente e respeitar as flags de homologação e produção.

## ETAPA 3 — Onboarding da academia

Criar orientação inicial dispensável e retomável para administradores recém-cadastrados:

- Completar os dados e logotipo da academia.
- Cadastrar primeiro plano.
- Cadastrar primeiro professor.
- Cadastrar primeiro aluno.
- Realizar primeira matrícula.
- Criar primeira ficha de treino.
- Configurar permissões.
- Configurar assinatura comercial.

Exibir progresso real, dicas contextuais e atalhos para as funcionalidades existentes.

## ETAPA 4 — Portal do Aluno

Criar área independente, moderna, visualmente atrativa e mobile-first, inspirada em aplicativos fitness e na organização visual do Canva.

Implementar:

- Rota /aluno/login.
- Autenticação por CPF e senha.
- Primeiro acesso seguro por convite ou código de ativação.
- Recuperação de senha segura.
- Identificação da academia, inclusive quando o CPF possuir vínculo com mais de uma unidade.
- Sessão e autorização exclusivas de aluno.
- Página inicial com nome, objetivo, professor responsável e progresso.
- Fichas de treino prescritas pelos professores.
- Cartões de treino A, B, C e demais divisões existentes.
- Orientações, séries, repetições, cargas, descanso e observações.
- Imagens ou vídeos demonstrativos quando disponíveis e devidamente licenciados.
- Histórico de treinos.
- Perfil e informações autorizadas da matrícula.
- Navegação inferior otimizada para celulares.

O aluno não poderá acessar dados de outros alunos, alterar prescrições ou acessar funções administrativas.

## ETAPA 5 — Execução interativa dos treinos

- Botão iniciar treino.
- Exibição individual dos exercícios.
- Marcação de séries concluídas.
- Registro de cargas e repetições realizadas.
- Cronômetro de descanso.
- Navegação entre exercícios.
- Indicador de progresso.
- Pausar, retomar e finalizar treino.
- Histórico de execução.
- Proteção contra registros duplicados.
- Permitir ao professor acompanhar a evolução dos seus alunos conforme suas permissões.

Preservar a prescrição original e registrar a execução separadamente.

## ETAPA 6 — Evolução e PWA

- Gráficos de evolução de cargas.
- Frequência e treinos concluídos.
- Objetivos definidos pelo professor.
- Resultados de avaliações físicas autorizados.
- Metas semanais.
- PWA instalável em Android e iOS pelo navegador.
- Não armazenar dados pessoais ou de saúde em cache público.
- Limpar dados locais sensíveis ao encerrar a sessão.

## REGRAS DE EXECUÇÃO

- Reutilizar código existente e evitar dependências desnecessárias.
- Executar por etapas, sem auditorias ou testes repetitivos.
- Preservar isolamento multi-tenant, permissões, segurança e LGPD.
- Caso sejam necessárias migrations a partir da 017, apresentar proposta objetiva e solicitar autorização antes da implementação.
- Não modificar o banco principal sem autorização.
- Validar alterações estruturais em PostgreSQL descartável.
- Manter pendentes a ativação Pix e a conclusão do checkout hospedado Asaas Sandbox, sem bloquear as melhorias independentes.
- Preservar a homologação Resend já concluída.
- Não habilitar cobranças reais nem cadastro público de produção.
- Não realizar commit, push ou operações destrutivas.
- Realizar testes direcionados e build ao concluir cada etapa.

Comece pela Etapa 1. Apresente um relatório curto das alterações, validações e pendências antes de avançar.