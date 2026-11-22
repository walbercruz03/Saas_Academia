# 📋 Análise Detalhada da Estrutura do Projeto IronControl → Wc Fit

## 🌳 ESTRUTURA DE DIRETÓRIOS

```
meu_saas/
├── frontend/              # React Vite (interface do usuário)
│   ├── index.html         # HTML principal - TÍTULO E META
│ ├── package.json         # Dependências React/Vite
│ ├── vite.config.js       # Configuração Vite (porta 5173)
│ ├── eslint.config.js     # Configuração ESLint
│ ├── src/
│   ├── main.jsx           # Ponto de entrada React
│ ├── api.js               # Configuração axios (baseURL: localhost:3001)
│ ├── components/          # Componentes reutilizáveis
│   └── Layout.jsx         # Layout com sidebar, navegação e header
│   └── Index.jsx          (se existir)
│   ├── contexts/          # Contextos React
│   │   └── AuthContext.jsx # Autenticação (login, logout, token)
│   ├── pages/             # Páginas da aplicação
│   │   ├── Login.jsx      # Tela de login
│   │   ├── CadastroAdmin.jsx # Cadastro de admin
│   │   ├── Planos.jsx     # Gestão de planos
│   │   ├── Alunos.jsx     # Gestão de alunos
│   │   ├── Matriculas.jsx # Gestão de matrículas
│   │   ├── Dashboard.jsx  # Dashboard com estatísticas e gráficos
│   │   ├── Checkin.jsx    # Check-in de alunos
│   │   └── Professores.jsx # Gestão de professores
│   ├── styles/            # CSS modularizado
│   │   ├── styles.css     # Base/layout global
│   │   ├── aluno.css      # Estilos página Alunos
│   │   ├── plano.css      # Estilos página Planos
│   │   ├── matricula.css  # Estilos página Matriculas
│   │   ├── checkin.css    # Estilos página Checkin
│   │   ├── professor.css  # Estilos página Professores
│   │   ├── dashboard.css  # Estilos página Dashboard
│   │   └── login.css      # Estilos página Login
│   └── styles/            # (duplicate past? might be error)
│       └── styles.css     # Global styles
│   └── App.jsx            # Roteamento principal
│   └── index.css          # Índices de estilo
└── backend/               # Node.js Express + SQLite
    ├── package.json         # Dependências (Express, sqlite3, jwt)
    ├── server.js           # Entry point - rotas health check + startup message
    ├── src/
    │   ├── config/          # Configuração de banco
    │   │   └── database.js  # Conexão SQLite
    │   ├── controllers/     # Controladores (lógica da API)
    │   │   ├── authController.js  # Registro/login admin
    │   │   ├── usuarioController.js
    │   │   ├── planoController.js
    │   │   ├── alunoController.js
    │   │   ├── matriculaController.js
    │   │   └── checkinController.js  # ← Principal para modificar busca por nome
    │   ├── middlewares/     # Middlewares Express
    │   │   ├── authMiddleware.js    # Verificação JWT
    │   │   └── isAdminMiddleware.js # Verificação admin
    │   ├── models/          # Modelos de banco (SQLite)
    │   │   ├── Usuario.js       # Tabela usuarios
    │   │   ├── Plano.js         # Tabela planos
    │   │   ├── Aluno.js         # Tabela alunos
    │   │   ├── Matricula.js     # Tabela matriculas
    │   │   └── Checkin.js       # Tabela checkins
    │   ├── routes/          # Rotas da API
    │   │   ├── authRoutes.js         # /api/auth/*
    │   │   ├── usuarioRoutes.js      # /api/usuarios/*
    │   │   ├── planoRoutes.js        # /api/planos/*
    │   │   ├── alunoRoutes.js        # /api/alunos/*
    │   │   ├── matriculaRoutes.js    # /api/matriculas/*
    │   │   └── checkinRoutes.js      # /api/checkin/*
    │   └── server.js          # (duplicate? might be at root)
    └── database.sqlite        # Banco de dados SQLite
```

---

## 🎯 ÁREAS PRINCIPÁRIAS PARA MODIFICAÇÃO

### 1. REBRANDING: IronControl → Wc Fit

| Arquivo | O Que Alterar | Como Alterar |
|---------|--------------|--------------|
| `frontend/index.html` | Linha 8: `<title>` e linha 7: `<meta name="description">` | `IronControl → Wc Fit` |
| `frontend/src/components/Layout.jsx` | Linha 40: `<h2>IronControl</h2>` e linha 38: `<div className="logo-badge">⚡</div>` | `h2 → Wc Fit`, `⚡ → WF` |
| `frontend/src/pages/Login.jsx` | Linhas 34, 36: `<h1>` e `<h2 className="welcome-msg">` | `IronControl → Wc Fit` |
| `frontend/src/pages/CadastroAdmin.jsx` | Linha 53: `<h1>IronControl</h1>` | `IronControl → Wc Fit` |
| `frontend/src/styles/*.css` (8 arquivos) | Linha 2: comentário `PÁGINA X - IronControl` | `IronControl → Wc Fit` |
| `backend/src/server.js` | Linhas 58, 62: `res.json({ servico: 'IronControl API' })` e `console.log('Servidor IronControl...')` | `IronControl API → Wc Fit API`, `Servidor IronControl → Wc Fit Servidor` |
| `backend/src/controllers/authController.js` | Linha 4: `const JWT_SECRET = ... 'ironcontrol_secret_dev'` | `ironcontrol_secret_dev → wcfit_secret_dev` |
| `backend/src/middlewares/authMiddleware.js` | Linha 16: `const secret = ... 'ironcontrol_secret_dev'` | `ironcontrol_secret_dev → wcfit_secret_dev` |
| `backend/src/package.json` | Linha 4: `"description": "IronControl - API de autenticação e gestão"` | `IronControl → Wc Fit` |
| `README.md` e `backend/src/README.md` | Todos os textos "IronControl" | `Wc Fit` |

### 2. BUSCAR ALUNO POR NOME NO CHECKIN

#### Backend: `backend/src/controllers/checkinController.js`

| Linha | O Que Alterar | Novo Valor |
|-------|--------------|------------|
| 13 | `const { cpf } = req.query;` | `const { nome } = req.query;` |
| 14 | `if (!cpf) {` | `if (!nome) {` |
| 14 | `return res.status(400).json({ mensagem: 'CPF é obrigatório.' });` | `return res.status(400).json({ mensagem: 'Nome é obrigatório.' });` |
| 19 | `const sql = \`SELECT * FROM alunos WHERE REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), '/', '') = ?\`;` | `const sql = \`SELECT * FROM alunos WHERE nome LIKE ?\`;` |
| 19 | `db.get(sql, [cpfLimpo], ...)` | `db.all(sql, ['%' + nome + '%'], ...)` |
| 20-23 | Resultados do `db.get` → `db.all` | Retorna `alunos[0]` em vez de `aluno` |

#### Frontend: `frontend/src/pages/Checkin.jsx`

| Linha | O Que Alterar | Novo Valor |
|-------|--------------|------------|
| ~Linha 10 | `const [cpf, setCpf] = useState('');` | `const [nome, setNome] = useState('');` |
| ~Linha 26 | `if (!cpf.trim()) { setErro('Informe o CPF do aluno.'); return; }` | `if (!nome.trim()) { setErro('Informe o nome do aluno.'); return; }` |
| ~Linha 29 | `const res = await api.get('/checkin/buscar-aluno', { params: { cpf: cpf.replace(/\\D/g, '') } });` | `const res = await api.get('/checkin/buscar-aluno', { params: { nome: nome.trim() } });` |

### 3. CSS MODULAR (Responsividade)

#### Arquivos de Estilo por Página:

| Arquivo | O Que Verificar/Alterar |
|---------|------------------------|
| `frontend/src/styles/aluno.css` | `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` → `minmax(240px, 1fr)` |
| `frontend/src/styles/plano.css` | Já vem com `minmax(240px, 1fr)` ✅ |
| `frontend/src/styles/matricula.css` | `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))` → `minmax(240px, 1fr)` |
| `frontend/src/styles/professor.css` | `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))` → `minmax(240px, 1fr)` |
| `frontend/src/styles/checkin.css` | Já vem com `minmax(240px, 1fr)` ✅ |
| `frontend/src/styles/dashboard.css` | `stats-grid` e `dashboard-grid-charts` já vêm com `minmax(240px, 1fr)` ✅ |
| `frontend/src/styles/styles.css` | Comentário de layout `Padrão IronControl` → `Wc Fit` |

#### Responsividade Mobile (768px):
- Todos os grids quebram para `1fr` em telas < 768px
- Botões: `width: 100%` em mobile
- Padding e fontes reduzidos em mobile

### 4. ROTAS DA API (Não mexer nessas)

#### Rotas Públicas/Protegidas:

| Arquivo | Rota | Acesso |
|---------|------|--------|
| `backend/src/routes/authRoutes.js` | `POST /api/auth/register-admin` | Público (cadastro admin) |
| | `POST /api/auth/login` | Público (login) |
| `backend/src/routes/usuarioRoutes.js` | `GET /api/usuarios` | Auth (admin/professor) |
| | `POST /api/usuarios` | Auth (admin) |
| `backend/src/routes/planoRoutes.js` | `GET/POST /api/planos` | Auth (admin/professor) |
| `backend/src/routes/alunoRoutes.js` | `GET/POST /api/alunos` | Auth (admin/professor) |
| `backend/src/routes/matriculaRoutes.js` | `GET/POST /api/matriculas` | Auth (admin/professor) |
| `backend/src/routes/checkinRoutes.js` | `GET /api/checkin` | Auth (admin/professor) |
| | `GET /api/checkin/buscar-aluno` | Auth (qualquer) |
| | `POST /api/checkin` | Auth (admin/professor) |

### 5. BANCO DE DADOS (SQLite)

#### Tabelas Principais (Não alterar estrutura):

| Tabela | Campos Importantes |
|--------|-------------------|
| `usuarios` | `id, nome, email_ou_matricula, senha_hash, cargo, status` |
| `alunos` | `id, nome, cpf, telefone, email, data_nascimento, status` |
| `planos` | `id, nome, descricao, preco, duracao_meses, status` |
| `matriculas` | `id, aluno_id, plano_id, data_inicio, data_vencimento, status, valor_pago` |
| `checkins` | `id, aluno_id, status, observacoes, data_checkin` |

**Relacionamentos:**
- `matriculas.aluno_id → alunos.id`
- `matriculas.plano_id → planos.id`
- `checkins.aluno_id → alunos.id`
- `alunos.cpf → único (UNIQUE)`

---

## 🔧 FLUXO DE TRABALHO QUANDO VAI MEXER NO CÓDIGO

### Passo 1: Identificar a área

1. **Rebranding visual?** → Arquivos `index.html`, `Layout.jsx`, páginas CSS, backend
2. **Funcionalidade de busca?** → `checkinController.js` + `Checkin.jsx`
3. **Estilo/layout?** → Arquivos `*.css` na pasta `src/styles/`
4. **Rotas/API?** → Arquivos `backend/src/routes/*.js`
5. **Lógica de negócio?** → `backend/src/controllers/*.js`

### Passo 2: Fazer a alteração

#### Padrão para alterar texto:
```bash
# Exemplo substituir IronControl por Wc Fit globalmente em um arquivo:
sed -i 's/IronControl/Wc Fit/g' caminho/do/arquivo
```

#### Padrão para alterar lógica de busca:
```javascript
// Antigo (busca por CPF)
const { cpf } = req.query;
const sql = `SELECT * FROM alunos WHERE REPLACE(...)`;
db.get(sql, [cpfLimpo], callback);

// Novo (busca por nome)
const { nome } = req.query;
const sql = `SELECT * FROM alunos WHERE nome LIKE ?`;
db.all(sql, ['%' + nome + '%'], callback);
```

#### Padrão frontend:
```javascript
// Antigo
const [cpf, setCpf] = useState('');
// ...
if (!cpf.trim()) { /* erro */ }
// ...
api.get('/checkin/buscar-aluno', { params: { cpf: ... } })

// Novo
const [nome, setNome] = useState('');
// ...
if (!nome.trim()) { /* erro */ }
// ...
api.get('/checkin/buscar-aluno', { params: { nome: nome.trim() } })
```

### Passo 3: Testar

1. Frontend: `cd frontend && npm run build` ✅
2. Backend: `cd backend/src && node server.js` - deve iniciar sem erros
3. Verificar se não há erros de sintaxe

### Passo 4: Verificar alterações

```bash
# Verificar se ainda tem "IronControl" nos fontes
grep -r "IronControl" frontend/src/ backend/src/ 2>/dev/null || echo "Nenhuma referência encontrada"

# Verificar build do frontend
cd frontend && npm run build 2>&1 | tail -5
```

---

## ⚠️ ARQUIVOS QUE NÃO DEVEM SER ALTERADOS (Lógica de Negócio)

- `backend/src/database.sqlite` - Estrutura das tabelas
- `backend/src/models/*.js` - Definições de esquema (exceto queries de busca)
- Rotas da API (mantê-las funcionando com a mesma estrutura)
- Namespaces de variáveis e segredos JWT (atualizar apenas o valor, não o nome)

---

## 📝 RESUMO RÁPIDO (Cheat Sheet)

| Tarefa | Arquivo Principal | Linha/Seção |
|--------|------------------|-------------|
| Mudar título da app | `frontend/index.html` | Linhas 7-8 |
| Mudar sidebar/header | `frontend/src/components/Layout.jsx` | Linhas 38-42 |
| Login/Cadastro h1 | `frontend/src/pages/Login.jsx` / `CadastroAdmin.jsx` | Linhas 34, 53 |
| CSS de página X | `frontend/src/styles/[pagina].css` | Linha 2 (comentário) |
| Buscar aluno por nome | `backend/src/controllers/checkinController.js` | Linhas 13-24 |
| Busca no frontend | `frontend/src/pages/Checkin.jsx` | Linhas 10, 26, 29 |
| Responsividade grid | `aluno.css:14`, `matricula.css:11`, `professor.css:23` | `minmax(2xxpx, 1fr)` → `minmax(240px, 1fr)` |

---

**Dica Pro:** Sempre faça `git status` após mudanças para ver o que foi modificado, e `git diff` para verificar as alterações antes de commitar!