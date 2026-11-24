require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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

app.use(cors());
app.use(express.json());

// Inicializa tabelas respeitando a ordem das chaves estrangeiras
db.serialize(() => {
  Usuario.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela usuarios:', err.message);
    else console.log('Tabela usuarios verificada/criada.');
  });
  Plano.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela planos:', err.message);
    else console.log('Tabela planos verificada/criada.');
  });
  Aluno.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela alunos:', err.message);
    else console.log('Tabela alunos verificada/criada.');
  });
  Matricula.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela matriculas:', err.message);
    else console.log('Tabela matriculas verificada/criada.');
  });
  Checkin.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela checkins:', err.message);
    else console.log('Tabela checkins verificada/criada.');
  });
  Treino.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela treinos:', err.message);
    else {
      console.log('Tabela treinos verificada/criada.');
      ExecucaoTreino.criarTabela((execErr) => {
        if (execErr) console.error('Erro ao criar tabela execucoes_treino:', execErr.message);
        else console.log('Tabela execucoes_treino verificada/criada.');
      });
    }
  });
  GrupoMuscular.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela grupos_musculares:', err.message);
    else {
      console.log('Tabela grupos_musculares verificada/criada.');
      Exercicio.criarTabela((exErr) => {
        if (exErr) console.error('Erro ao criar tabelas exercicios / exercicio_grupos_musculares:', exErr.message);
        else {
          console.log('Tabelas exercicios e exercicio_grupos_musculares verificadas/criadas.');
          ModeloTreino.criarTabela((modErr) => {
            if (modErr) console.error('Erro ao criar tabelas modelos_treino / modelo_treino_exercicios:', modErr.message);
            else console.log('Tabelas modelos_treino e modelo_treino_exercicios verificadas/criadas.');
          });
        }
      });
    }
  });
  Financeiro.criarTabela((err) => {
    if (err) console.error('Erro ao criar tabela movimentacoes_financeiras:', err.message);
    else console.log('Tabela movimentacoes_financeiras verificada/criada.');
  });

  executarMigracoes().catch((err) => {
    console.error('[MIGRAÇÕES] Erro ao sincronizar migrações no startup:', err.message);
  });
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/planos', planoRoutes);
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

app.listen(PORT, () => {
  console.log(`Wc Fit Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;