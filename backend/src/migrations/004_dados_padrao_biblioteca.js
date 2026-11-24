function executar(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this?.lastID, changes: this?.changes });
    });
  });
}

function buscarTodas(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  up: async (db) => {
    // 1. Inserir exercícios da biblioteca global (sistema) - academia_id = 0
    const exerciciosSistema = [
      { nome: 'Supino Reto', descricao: 'Exercício fundamental para desenvolvimento do peito', equipamento: 'Bilhararia', dificuldade: 'intermediario' },
      { nome: 'Supino Inclinado', descricao: 'Foco na parte superior do peito', equipamento: 'Bilhararia', dificuldade: 'intermediario' },
      { nome: 'Flying Machine', descricao: 'Abição do peito para definição muscular', equipamento: 'Máquina', dificuldade: 'intermediario' },
      { nome: 'Crucifixo', descricao: 'Exercício isométrico para isolamento do peito', equipamento: 'Halteres', dificuldade: 'intermediario' },
      { nome: 'Remada Baixada', descricao: 'Desenvolvimento da espessura das costas', equipamento: 'Barra', dificuldade: 'intermediario' },
      { nome: 'Remada Unilateral', descricao: 'Foco em cada lado das costas individualmente', equipamento: 'Halteres', dificuldade: 'intermediario' },
      { nome: 'Puxador Frontal', descricao: 'Desenvolvimento da largura das costas', equipamento: 'Puxador', dificuldade: 'intermediario' },
      { nome: 'Leg Press', descricao: 'Press perna para desenvolvimento de quadríceps', equipamento: 'Leg Press', dificuldade: 'intermediario' },
      { nome: 'Leg Extension', descricao: 'Isolamento de quadríceps na máquina', equipamento: 'Máquina', dificuldade: 'intermediario' },
      { nome: 'Leg Curl', descricao: 'Isolamento de isquiais na máquina', equipamento: 'Máquina', dificuldade: 'intermediario' },
      { nome: 'Agachamento Livre', descricao: 'Agachamento com peso corporal ou barra', equipamento: 'Barra', dificuldade: 'avancado' },
      { nome: 'Desenvolvimento Militar', descricao: 'Elevação de braços acima da cabeça', equipamento: 'Bilhararia', dificuldade: 'intermediario' },
      { nome: 'Elevação Lateral', descricao: 'Foco na região do delt lateral', equipamento: 'Halteres', dificuldade: 'intermediario' },
      { nome: 'Tríceps Extensão', descricao: 'Extensão de tríceps', equipamento: 'Halteres/Máquina', dificuldade: 'intermediario' },
      { nome: 'Bíceps Curl', descricao: 'Flexão de bíceps', equipamento: 'Halteres', dificuldade: 'intermediario' },
    ];

    for (const ex of exerciciosSistema) {
      const existente = await buscarTodas(db, 'SELECT id FROM exercicios WHERE nome = ?', [ex.nome]);
      if (existente.length === 0) {
        await executar(db, `INSERT INTO exercicios (nome, descricao, equipamento, dificuldade, academia_id) VALUES (?, ?, ?, ?, 0)`, 
          [ex.nome, ex.descricao, ex.equipamento, ex.dificuldade]);
      }
    }
    console.log('[MIGRACAO] Exercicios da biblioteca global inseridos.');

    // 2. Inserir modelos de treino padrão por nível
    const modelosPadrao = [
      { nome: 'Corpo Inteiro Iniciante', descricao: 'Treino completo para iniciantes', divisao: 'Corpo Inteiro', nivel: 'iniciante', objetivo: 'Hipertrofia Geral', academia_id: 0 },
      { nome: 'Upper/Lower Intermediario', descricao: 'Divisao Upper/Lower com 4 sessoes por semana', divisao: 'Upper/Lower', nivel: 'intermediario', objetivo: 'Hipertrofia', academia_id: 0 },
      { nome: 'Treino A - Hipertrofia', descricao: 'Divisao A focada em massa muscular', divisao: 'Treino A', nivel: 'avancado', objetivo: 'Hipertrofia', academia_id: 0 },
      { nome: 'Treino B - Definicao', descricao: 'Divisao B focada em definicao e queima de gordura', divisao: 'Treino B', nivel: 'avancado', objetivo: 'Definicao', academia_id: 0 },
    ];

    for (const mod of modelosPadrao) {
      const existente = await buscarTodas(db, 'SELECT id FROM modelos_treino WHERE nome = ? AND academia_id = ?', [mod.nome, mod.academia_id]);
      if (existente.length === 0) {
        const sql = `INSERT INTO modelos_treino (nome, descricao, divisao, nivel, objetivo, academia_id) VALUES (?, ?, ?, ?, ?, ?)`;
        await executar(db, sql, [mod.nome, mod.descricao, mod.divisao, mod.nivel, mod.objetivo, mod.academia_id]);
      }
    }
    console.log('[MIGRACAO] Modelos de treino padrao inseridos.');

    // 3. Inserir academia padrão para testes se não existir
    const academiaExistente = await buscarTodas(db, 'SELECT id FROM academias LIMIT 1');
    if (academiaExistente.length === 0) {
      await executar(db, `INSERT INTO academias (nome, cnpj, nome_fantasia, endereco, telefone, email, plano, limite_alunos, limite_professores, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, 
        ['Academia Padrão', '00.000.000/0000-00', 'Academia Padrão', 'Endereço Padrão', '00-0000-0000', 'padrao@wcfit.com', 'basico', 100, 10]);
      console.log('[MIGRACAO] Academia padrao inserida.');
    }

    console.log('[MIGRACAO] Biblioteca padrão de exercicios e modelos de treino concluida.');
  },

  down: async (db) => {
    await executar(db, `DELETE FROM modelo_treino_exercicios WHERE modelo_id IN (SELECT id FROM modelos_treino WHERE academia_id = 0)`);
    await executar(db, `DELETE FROM divisoes_treino WHERE modelo_id IN (SELECT id FROM modelos_treino WHERE academia_id = 0)`);
    await executar(db, `DELETE FROM modelos_treino WHERE academia_id = 0`);
    await executar(db, `DELETE FROM exercicios WHERE academia_id = 0`);
    await executar(db, `DELETE FROM academias WHERE nome = 'Academia Padrão'`);
    console.log('[MIGRACAO] Dados padrao removidos.');
  }
};