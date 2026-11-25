require('dotenv').config();
require('./middlewares/authMiddleware').segredoJwt();
const express = require('express');
const cors = require('cors');
const path = require('path');
const logFalha = require('./utils/logFalha');
const db = require('./config/database');
const Usuario = require('./models/Usuario');
const Plano = require('./models/Plano');
const Aluno = require('./models/Aluno');
const Matricula = require('./models/Matricula');
const Checkin = require('./models/Checkin');
const Treino = require('./models/Treino');
const GrupoMuscular = require('./models/GrupoMuscular');
const Exercicio = require('./models/Exercicio');
const ModeloTreino = require('./models/ModeloTreino');
const ExecucaoTreino = require('./models/ExecucaoTreino');
const Financeiro = require('./models/Financeiro');
const { executarMigracoes } = require('./migrations/runner');

const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const planoRoutes = require('./routes/planoRoutes');
const alunoRoutes = require('./routes/alunoRoutes');
const matriculaRoutes = require('./routes/matriculaRoutes');
const checkinRoutes = require('./routes/checkinRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const treinoRoutes = require('./routes/treinoRoutes');
const grupoMuscularRoutes = require('./routes/grupoMuscularRoutes');
const exercicioRoutes = require('./routes/exercicioRoutes');
const modeloTreinoRoutes = require('./routes/modeloTreinoRoutes');
const execucaoTreinoRoutes = require('./routes/execucaoTreinoRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const modalidadeRoutes = require('./routes/modalidadeRoutes');
const nivelDificuldadeRoutes = require('./routes/nivelDificuldadeRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// A administração global usa cookie de mesma origem e fica fora do CORS das APIs comuns.
app.use('/api/super-admin', require('./routes/superAdminRoutes'));
app.use('/api/convites', require('./routes/conviteRoutes'));
app.use('/api/asaas-sandbox', require('./routes/asaasSandboxRoutes'));
app.use('/api/aluno', require('./routes/portalAlunoRoutes').router);
app.use(cors({ origin: process.env.APP_CORS_ORIGIN || '*', exposedHeaders: ['Idempotency-Replayed'] }));
app.get('/api/documentos-legais', (_req,res) => {
  const documentos = require('./services/documentosLegais').aprovados();
  res.set('Cache-Control','no-store');
  return documentos ? res.json(documentos) : res.status(404).end();
});
app.use('/api/cadastro-publico', require('./routes/cadastroPublicoRoutes'));
app.use(express.json());
app.use('/api/configuracoes', require('./routes/configuracoesAcademiaRoutes'));

// Inicializa tabelas respeitando a ordem das chaves estrangeiras
const inicializarBanco = () => db.serialize(() => {
  Usuario.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela usuarios', err);
    else console.log('Tabela usuarios verificada/criada.');
  });
  Plano.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela planos', err);
    else console.log('Tabela planos verificada/criada.');
  });
  Aluno.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela alunos', err);
    else console.log('Tabela alunos verificada/criada.');
  });
  Matricula.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela matriculas', err);
    else console.log('Tabela matriculas verificada/criada.');
  });
  Checkin.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela checkins', err);
    else console.log('Tabela checkins verificada/criada.');
  });
  Treino.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela treinos', err);
    else {
      console.log('Tabela treinos verificada/criada.');
      ExecucaoTreino.criarTabela((execErr) => {
        if (execErr) logFalha('Erro ao criar tabela execucoes_treino', execErr);
        else console.log('Tabela execucoes_treino verificada/criada.');
      });
    }
  });
  GrupoMuscular.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela grupos_musculares', err);
    else {
      console.log('Tabela grupos_musculares verificada/criada.');
      Exercicio.criarTabela((exErr) => {
        if (exErr) logFalha('Erro ao criar tabelas exercicios / exercicio_grupos_musculares', exErr);
        else {
          console.log('Tabelas exercicios e exercicio_grupos_musculares verificadas/criadas.');
          ModeloTreino.criarTabela((modErr) => {
            if (modErr) logFalha('Erro ao criar tabelas modelos_treino / modelo_treino_exercicios', modErr);
            else console.log('Tabelas modelos_treino e modelo_treino_exercicios verificadas/criadas.');
          });
        }
      });
    }
  });
  Financeiro.criarTabela((err) => {
    if (err) logFalha('Erro ao criar tabela movimentacoes_financeiras', err);
    else console.log('Tabela movimentacoes_financeiras verificada/criada.');
  });

  executarMigracoes().catch((err) => {
    logFalha('[MIGRAÇÕES] Erro ao sincronizar migrações no startup', err);
  });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/planos', planoRoutes);
const gestaoPortalAluno = require('./routes/gestaoPortalAlunoRoutes');
app.use('/api/alunos/:id/portal', gestaoPortalAluno.alunos);
app.use('/api/exercicios/:id/portal-imagem', gestaoPortalAluno.exercicios);
app.use('/api/alunos', alunoRoutes);
app.use('/api/matriculas', matriculaRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/treinos', treinoRoutes);
app.use('/api/grupos-musculares', grupoMuscularRoutes);
app.use('/api/exercicios', exercicioRoutes);
app.use('/api/modelos-treino', modeloTreinoRoutes);
app.use('/api/execucoes-treino', execucaoTreinoRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/modalidades', modalidadeRoutes);
app.use('/api/niveis-dificuldade', nivelDificuldadeRoutes);

// Rota de saúde
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', servico: 'Wc Fit API' });
});

app.get('/api/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (db.isSqlite) {
      await new Promise((resolve, reject) => db.get('SELECT 1', (erro) => erro ? reject(erro) : resolve()));
    } else {
      await db.pool.query({ text: 'SELECT 1', query_timeout: 2000 });
    }
    return res.json({ status: 'pronto' });
  } catch {
    return res.status(503).json({ status: 'indisponivel' });
  }
});

db.pronto.then(() => {
  inicializarBanco();
  require('./services/asaasConciliacao').iniciarFila();
  app.listen(PORT, () => {
    console.log(`WC Fit Servidor rodando em http://localhost:${PORT}`);
  });
}).catch((err) => {
  logFalha('Falha ao iniciar o backend', err);
  process.exitCode = 1;
  db.pool?.end();
});

module.exports = app;
