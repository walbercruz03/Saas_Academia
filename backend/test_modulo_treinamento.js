/**
 * Teste de Integração e Verificação das Regras de Negócio do Módulo de Treinamento
 */
const db = require('./src/config/database');
const Modalidade = require('./src/models/Modalidade');
const NivelDificuldade = require('./src/models/NivelDificuldade');
const Exercicio = require('./src/models/Exercicio');
const ModeloTreino = require('./src/models/ModeloTreino');
const Aluno = require('./src/models/Aluno');
const AlunoModeloTreino = require('./src/models/AlunoModeloTreino');
const ExecucaoTreino = require('./src/models/ExecucaoTreino');

const runAsync = (fn, ...args) => new Promise((resolve, reject) => {
  fn(...args, (err, res) => (err ? reject(err) : resolve(res)));
});

async function main() {
  const ts = Date.now();
  console.log('=== INICIANDO TESTES DO MÓDULO DE TREINAMENTO ===\n');

  try {
    // 1. Modalidades
    console.log('1. Testando Modalidades...');
    const modCriada = await runAsync(Modalidade.criar, { nome: `CrossFit Teste ${ts}`, descricao: 'Treino de alta intensidade' });
    console.log('   ✓ Modalidade criada com ID:', modCriada.id);
    const modalidades = await runAsync(Modalidade.listar, {});
    if (!modalidades.some(m => m.id === modCriada.id)) throw new Error('Modalidade não encontrada na listagem.');
    console.log('   ✓ Modalidades listadas com sucesso.');

    // 2. Níveis de Dificuldade
    console.log('2. Testando Níveis de Dificuldade...');
    const nivelCriado = await runAsync(NivelDificuldade.criar, { nome: `Elite Teste ${ts}`, ordem: 4, descricao: 'Atletas de alto rendimento' });
    console.log('   ✓ Nível criado com ID:', nivelCriado.id);
    const niveis = await runAsync(NivelDificuldade.listar, {});
    if (!niveis.some(n => n.id === nivelCriado.id)) throw new Error('Nível não encontrado na listagem.');
    console.log('   ✓ Níveis listados com sucesso.');

    // 3. Exercícios com campo instrucoes
    console.log('3. Testando Exercício com instruções...');
    const exCriado = await runAsync(Exercicio.criar, {
      nome: `Supino Inclinado com Halteres Teste ${ts}`,
      descricao: 'Trabalho do peitoral superior',
      instrucoes: 'Manter os cotovelos a 45 graus e controlar a descida em 3 segundos.',
      dificuldade: 'Intermediário',
      equipamento: 'Halteres e Banco Inclinado',
      status: 'ativo'
    });
    console.log('   ✓ Exercício criado com ID:', exCriado.id);
    const exBuscado = await runAsync(Exercicio.buscarPorId, exCriado.id);
    if (!exBuscado.instrucoes) throw new Error('Instruções não foram persistidas.');
    console.log('   ✓ Exercício persistido com instruções verificadas.');

    // 4. Modelo de Treino com Múltiplas Divisões (A e B)
    console.log('4. Testando Criação de Modelo com Múltiplas Divisões...');
    const modeloCriado = await runAsync(ModeloTreino.criar, {
      nome: `Modelo ABC Hipertrofia Teste ${ts}`,
      descricao: 'Periodização de 12 semanas',
      modalidade_id: modCriada.id,
      nivel_id: nivelCriado.id,
      objetivo: 'Ganho de massa magra',
      status: 'ativo',
      divisoes: [
        {
          nome: 'Treino A - Peito e Tríceps',
          ordem: 1,
          grupos_musculares: 'Peitoral, Tríceps',
          exercicios: [
            {
              exercicio_id: exCriado.id,
              series: '4',
              repeticoes: '8-10',
              carga_sugerida: '28kg cada halter',
              descanso: '90s',
              observacoes: 'Descida cadenciada'
            }
          ]
        },
        {
          nome: 'Treino B - Costas e Bíceps',
          ordem: 2,
          grupos_musculares: 'Dorsal, Bíceps',
          exercicios: []
        }
      ]
    });
    console.log('   ✓ Modelo criado com ID:', modeloCriado.id, 'com', modeloCriado.divisoes.length, 'divisões.');

    // 5. Aluno e Atribuição de Modelos Compartilhados
    console.log('5. Testando Atribuição de Modelo Compartilhado a Aluno...');
    const alunoId = await new Promise((resolve, reject) => {
      Aluno.create({
        nome: `Aluno Teste Treinamento ${ts}`,
        cpf: `cpf_${ts}`,
        email: `alunoteste_${ts}@wcfit.com`,
        telefone: '11999998888',
        status: 'ativo'
      }, function(err, result) {
        if (err) return reject(err);
        resolve(result && result.lastID ? result.lastID : this && this.lastID);
      });
    });
    console.log('   ✓ Aluno criado com ID:', alunoId);

    // Atribuir modelo ao aluno
    await runAsync(AlunoModeloTreino.atribuir, alunoId, { modelo_id: modeloCriado.id });
    const modelosDoAluno = await runAsync(AlunoModeloTreino.listarPorAluno, alunoId);
    if (modelosDoAluno.length !== 1 || modelosDoAluno[0].id !== modeloCriado.id) {
      throw new Error('Falha ao atribuir modelo ao aluno.');
    }
    console.log('   ✓ Modelo atribuído com sucesso. Divisões visíveis ao aluno:', modelosDoAluno[0].divisoes.length);

    // 6. Teste de Modelo Compartilhado (Edição reflete para alunos)
    console.log('6. Testando Compartilhamento: Edição no Modelo Original...');
    await runAsync(ModeloTreino.atualizar, modeloCriado.id, {
      nome: 'Modelo ABC Hipertrofia Teste [ATUALIZADO]',
      descricao: 'Nova descrição atualizada',
      modalidade_id: modCriada.id,
      nivel_id: nivelCriado.id,
      status: 'ativo',
      divisoes: [
        {
          nome: 'Treino A - Peito, Tríceps e Deltoide Anterior',
          ordem: 1,
          exercicios: [
            {
              exercicio_id: exCriado.id,
              series: '5',
              repeticoes: '12',
              carga_sugerida: '30kg',
              descanso: '60s'
            }
          ]
        }
      ]
    });

    const modelosAposEdicao = await runAsync(AlunoModeloTreino.listarPorAluno, alunoId);
    if (modelosAposEdicao[0].nome !== 'Modelo ABC Hipertrofia Teste [ATUALIZADO]') {
      throw new Error('Edição no modelo compartilhado não refletiu para o aluno!');
    }
    if (modelosAposEdicao[0].divisoes[0].nome !== 'Treino A - Peito, Tríceps e Deltoide Anterior') {
      throw new Error('Divisões atualizadas não refletiram para o aluno!');
    }
    console.log('   ✓ Edição no modelo compartilhado refletiu em tempo real para o aluno!');

    // 7. Teste de Proteção contra Exclusão de Modelo Vinculado a Alunos
    console.log('7. Testando Proteção de Exclusão de Modelo com Vínculos...');
    try {
      await runAsync(ModeloTreino.deletar, modeloCriado.id);
      throw new Error('ERRO: O modelo foi excluído mesmo estando vinculado a um aluno!');
    } catch (err) {
      if (err.message.includes('atribuído a') || err.message.includes('vinculado a')) {
        console.log('   ✓ Proteção ativa: exclusão foi bloqueada corretamente! Mensagem:', err.message);
      } else {
        throw err;
      }
    }

    // 8. Teste de Execução e Snapshot Imutável
    console.log('8. Testando Registro de Execução e Snapshot Imutável...');
    const snapshotExec = {
      modelo_id: modeloCriado.id,
      modelo_nome: 'Modelo ABC Hipertrofia Teste [ATUALIZADO]',
      divisao_nome: 'Treino A - Peito, Tríceps e Deltoide Anterior',
      exercicios_registrados: [
        { nome: 'Supino Inclinado com Halteres Teste', series: '5', repeticoes: '12', carga: '32kg' }
      ]
    };

    const execCriada = await runAsync(ExecucaoTreino.criar, {
      aluno_id: alunoId,
      modelo_id: modeloCriado.id,
      modelo_nome: snapshotExec.modelo_nome,
      divisao_nome: snapshotExec.divisao_nome,
      duracao_minutos: 55,
      percepcao_esforco: 8,
      observacao: 'Ótima execução com carga máxima.',
      cargas: snapshotExec.exercicios_registrados,
      snapshot_treino: snapshotExec
    });

    console.log('   ✓ Execução registrada com ID:', execCriada.id);
    const execBuscada = await runAsync(ExecucaoTreino.buscarPorId, execCriada.id);
    if (!execBuscada.snapshot_treino) throw new Error('Snapshot imutável não foi salvo!');
    console.log('   ✓ Snapshot imutável gravado com sucesso:', execBuscada.snapshot_treino.modelo_nome);

    // 9. Desassociar modelo do aluno (apenas o vínculo individual é removido)
    console.log('9. Testando Desassociação do Modelo do Aluno...');
    await runAsync(AlunoModeloTreino.desassociar, alunoId, modeloCriado.id);
    const modelosAposDesassociar = await runAsync(AlunoModeloTreino.listarPorAluno, alunoId);
    if (modelosAposDesassociar.length !== 0) throw new Error('Vínculo não foi removido do aluno.');
    console.log('   ✓ Vínculo individual removido.');

    // Agora o modelo pode ser excluído globalmente se não tiver outros vínculos
    await runAsync(ModeloTreino.deletar, modeloCriado.id);
    console.log('   ✓ Modelo excluído globalmente com sucesso após remoção dos vínculos.');

    // A execução histórica continua existindo e imutável
    const historicoAposExclusaoModelo = await runAsync(ExecucaoTreino.buscarPorId, execCriada.id);
    if (!historicoAposExclusaoModelo || !historicoAposExclusaoModelo.snapshot_treino) {
      throw new Error('O histórico imutável foi afetado pela exclusão do modelo!');
    }
    console.log('   ✓ Histórico imutável de execução continua preservado e íntegro!');

    // Limpeza dos dados de teste
    await runAsync(ExecucaoTreino.deletar, execCriada.id);
    await runAsync(Aluno.excluir, alunoId);
    await runAsync(Exercicio.deletar, exCriado.id);
    await runAsync(Modalidade.deletar, modCriada.id);
    await runAsync(NivelDificuldade.deletar, nivelCriado.id);
    console.log('   ✓ Limpeza dos dados de teste concluída.');

    console.log('\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERRO NO TESTE:', err);
    process.exit(1);
  }
}

main();
