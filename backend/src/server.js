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
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const planoRoutes = require('./routes/planoRoutes');
const alunoRoutes = require('./routes/alunoRoutes');
const matriculaRoutes = require('./routes/matriculaRoutes');
const checkinRoutes = require('./routes/checkinRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Inicializa tabelas
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
});

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/planos', planoRoutes);
app.use('/api/alunos', alunoRoutes);
app.use('/api/matriculas', matriculaRoutes);
app.use('/api/checkin', checkinRoutes);

// Rota de saúde
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', servico: 'Wc Fit API' });
});

app.listen(PORT, () => {
  console.log(`Wc Fit Servidor rodando em http://localhost:${PORT}`);
});

module.exports = app;
