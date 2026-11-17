# Wc Fit — Sistema de Gestão para Academias (SaaS)

Sistema web full-stack para gestão operacional e financeira de academias e studios, focado em controle de acesso por perfil (RBAC), gestão de alunos, treinos, financeiro e check-in inteligente.# Sistema de Gestão para Academias (SaaS)


## Stack Tecnológica & Estrutura Atual

- **Backend:** Node.js (`server.js`), arquitetura MVC (`config`, `controllers`, `middlewares`, `models`, `routes`, `utils`), Banco de Dados SQLite (`database.sqlite`).
- **Frontend:** React + Vite (`frontend/src`).
- **Módulo Futuro (IA/Visão Computacional):** Microserviço/script em Python (`requirements.txt` já preparado no backend) para check-in por reconhecimento facial via webcam da recepção, dispensando catraca física.

---

## Regras de Negócio e Controle de Acesso (RBAC)

O sistema possui dois níveis de acesso principais:

1. **Administrador (`admin`)**
   - Realiza o cadastro inicial do estabelecimento/admin.
   - Cadastra, edita e ativa/inativa usuários do tipo **Professor** (gerando login/matrícula e senha).
   - Acesso **total** a todos os módulos: Dashboard financeiro, Relatórios de vendas mensais detalhados, Controle de caixa (Pix, Cartão, Dinheiro), Planos, Alunos e Treinos.

2. **Professor (`professor`)**
   - Acessa o sistema com as credenciais liberadas pelo Admin.
   - Acesso **restrito** apenas aos módulos operacionais: Cadastro/Consulta de Alunos, Montagem de Fichas de Treino (por objetivo/grupo muscular) e Check-in/Presença.
   - **Bloqueado** de visualizar menus e rotas de Faturamento, Caixa, Planos e Relatórios de Vendas.

---

## Módulos do Sistema (Escopo Completo)

1. **Autenticação e Gestão de Equipe:** Login unificado (JWT), middleware de verificação de cargo (`admin` vs `professor`) e CRUD de professores feito pelo Admin.
2. **Gestão de Alunos (CRM):** Cadastro completo, foto, contato de emergência, anamnese e status (Ativo, Inativo, Inadimplente).
3. **Planos e Matrículas:** Tipos de planos (Mensal, Trimestral, Anual), datas de vencimento e bloqueio automático por atraso.
4. **Financeiro e Caixa:** Registro de mensalidades/vendas por forma de pagamento (**Pix, Cartão, Dinheiro**) e controle de inadimplência.
5. **Prescrição de Treinos:** Biblioteca de exercícios e montagem de fichas personalizadas por aluno.
6. **Relatórios e Dashboard (Exclusivo Admin):** Faturamento mensal, fluxo de caixa e relatório detalhado de vendas por período/forma de pagamento.
7. **Controle de Acesso / Check-in:** Validação de status do aluno na entrada (inicialmente manual/QR Code e posteriormente via reconhecimento facial em Python).

---

## Roadmap de Desenvolvimento (Ordem de Execução para a Cline)

### Fase 1: Fundação, Autenticação e Controle de Acesso (INICIAR AQUI)
- [ ] **Backend (`database.sqlite`):** Criar model e tabela `usuarios` (`id`, `nome`, `email_ou_matricula`, `senha_hash`, `cargo` ['admin', 'professor'], `status`, `criado_em`).
- [ ] **Backend (Auth):** Criar rotas de registro inicial de Admin (`POST /api/auth/register-admin`) e login (`POST /api/auth/login`) retornando token JWT com o `cargo`.
- [ ] **Backend (Middlewares):** Criar `authMiddleware` (valida JWT) e `isAdminMiddleware` (bloqueia rotas financeiras para professores).
- [ ] **Backend (Gestão de Professores):** Criar CRUD protegido por `isAdminMiddleware` (`POST /api/usuarios`, `GET /api/usuarios`) para o Admin cadastrar e gerenciar professores.

  - [ ] **Frontend (Identidade e Páginas Base):**
  - Definir o nome **Wc Fit** no título da aplicação (`frontend/index.html`) e no cabeçalho visual da tela de login, acompanhado do subtítulo *"Gestão inteligente para academias e studios"*.
  - Criar tela de **Login** limpa e intuitiva (campos de E-mail/Matrícula, Senha com botão de mostrar/ocultar e feedback claro de erro) e tela de **Cadastro Inicial de Admin**.
  - Criar estrutura de **Layout/Sidebar dinâmico** exibindo a marca **Wc Fit** no topo e filtrando os menus conforme o `cargo` (`admin` vê tudo; `professor` vê apenas Alunos, Treinos e Check-in).
  - Criar página **Equipe/Professores** (visível apenas para Admin) para cadastrar novos professores.

### Fase 2: Cadastros Base (Planos e Alunos)
- [ ] CRUD de Planos (Admin) e CRUD de Alunos (Admin e Professor).
- [ ] Vínculo de Matrícula (Aluno + Plano + Data de Vencimento).

### Fase 3: Operacional (Fichas de Treino)
- [ ] Cadastro de exercícios e montagem de fichas de treino vinculadas ao aluno.

### Fase 4: Financeiro e Relatórios (Exclusivo Admin)
- [ ] Registro de pagamentos (Pix, Cartão, Dinheiro) com baixa na matrícula.
- [ ] Dashboard e Relatório de Vendas Detalhado Mensal.

### Fase 5: Check-in e Reconhecimento Facial (Python)
- [ ] Integração com webcam via Python (`OpenCV` / `face_recognition`) consultando a API Node.js para liberar ou bloquear acesso conforme adimplência.