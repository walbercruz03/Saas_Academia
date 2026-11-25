const { createHash } = require('node:crypto');
const { consulta, transacao } = require('../models/SuperAdmin');
const portal = require('./portalAluno');
const { acesso } = require('./permissoesProfessor');

const erro = (status,mensagem) => Object.assign(new Error(mensagem),{status});
const uuid = (valor) => typeof valor === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(valor);
const inteiro = (valor,min,max) => Number.isInteger(valor) && valor >= min && valor <= max;
const paginaValida = (valor) => typeof valor === 'string' && /^[1-9][0-9]{0,4}$/.test(valor);
const porPagina = 20;

async function pronto() {
  const { rows:[schema] } = await consulta("SELECT to_regclass('public.aluno_portal_execucoes') IS NOT NULL AS pronto");
  if (!schema.pronto) throw erro(503,'A execução interativa está indisponível neste ambiente.');
}

function chaveExercicio(ex) {
  return ex.exercicio_id ? 'id:' + ex.exercicio_id : 'nome:' + ex.nome.trim().normalize('NFKC').toLowerCase();
}

function seriesPrevistas(ex) {
  const quantidade = Number(ex.series.match(/^\s*(\d+)/)?.[1]);
  return quantidade > 0 ? Math.min(quantidade,100) : 1;
}

function temporal(row) {
  const agora = new Date(row.agora).getTime();
  const restante = row.descanso_ate ? Math.max(0, new Date(row.descanso_ate).getTime() - agora) : row.descanso_pausado_ms;
  const ativo = row.ativo_desde ? Math.max(0,Math.floor((agora - new Date(row.ativo_desde).getTime()) / 1000)) : 0;
  return { agora, restante, duracao:Math.min(row.duracao_segundos + ativo,2147483647) };
}

function resumo(row) {
  const registros = Object.values(row.series);
  const contagem = new Map();
  for (const { exercicio } of registros) contagem.set(exercicio,(contagem.get(exercicio) || 0)+1);
  return {
    id:row.id, ficha_id:row.ficha_id, nome:row.prescricao.nome, estado:row.estado,
    iniciado_em:row.iniciado_em, finalizado_em:row.finalizado_em, duracao_segundos:temporal(row).duracao,
    series_concluidas:registros.length, exercicios_concluidos:row.prescricao.exercicios.filter((ex,indice) => contagem.get(indice) === ex.total_series).length,
    series_previstas:row.prescricao.exercicios.reduce((total,ex) => total+ex.total_series,0),
  };
}

async function detalhe(row, academia) {
  const biblioteca = await portal.bibliotecaDasFichas(academia,[row.prescricao]);
  return {
    ...resumo(row), agora:row.agora, versao:row.versao, exercicio_atual:row.exercicio_atual,
    descanso_ate:row.descanso_ate, descanso_pausado_ms:row.descanso_pausado_ms,
    series:row.series, exercicios:row.prescricao.exercicios.map((ex) => ({
      ...ex, imagem_url:portal.imagemHttps(biblioteca.get(ex.exercicio_id)?.imagem_url),
    })),
  };
}

async function validarSessaoParaGravacao(client,{ academia_id,aluno_id },token) {
  // Mantém a ordem de bloqueio da revogação administrativa: acesso, depois sessão.
  const { rowCount:permissao } = await client.query(`
    SELECT p.aluno_id FROM aluno_portal_acessos p
    JOIN alunos al ON al.id=p.aluno_id AND al.academia_id=p.academia_id AND al.status <> 'inativo'
    JOIN academias a ON a.id=p.academia_id AND a.ativo=1 AND a.excluida_em IS NULL
    WHERE p.academia_id=$1 AND p.aluno_id=$2 AND NOT p.bloqueado AND p.senha_hash IS NOT NULL
    FOR UPDATE OF p
  `,[academia_id,aluno_id]);
  if (!permissao) throw erro(401,'Entre no Portal do Aluno.');
  const { rowCount:sessao } = await client.query(`
    SELECT token_hash FROM aluno_portal_sessoes
    WHERE academia_id=$1 AND aluno_id=$2 AND token_hash=$3 AND expira_em>clock_timestamp() FOR SHARE
  `,[academia_id,aluno_id,createHash('sha256').update(token || '').digest('hex')]);
  if (!sessao) throw erro(401,'Entre no Portal do Aluno.');
}

async function ultimasCargas(client,academia,aluno,chaves) {
  const { rows } = await client.query(`
    SELECT DISTINCT ON (r.valor->>'chave') r.valor->>'chave' AS chave, r.valor->'carga' AS carga
    FROM aluno_portal_execucoes e CROSS JOIN LATERAL jsonb_each(e.series) AS r(serie,valor)
    WHERE e.academia_id=$1 AND e.aluno_id=$2 AND e.estado='finalizado'
      AND r.valor->>'chave'=ANY($3::text[])
    ORDER BY r.valor->>'chave', e.finalizado_em DESC, e.id DESC, (r.valor->>'versao')::integer DESC
  `,[academia,aluno,chaves]);
  return new Map(rows.map((row) => [row.chave,row.carga]));
}

async function iniciar(vinculo,token,fichaId,chave) {
  if (!uuid(chave) || typeof fichaId !== 'string' || !/^(?:ficha-\d+|modelo-\d+-\d+)$/.test(fichaId) || fichaId.length > 55) {
    throw erro(400,'Confira a ficha e tente novamente.');
  }
  const { academia_id:academia,aluno_id:aluno } = vinculo;
  const ficha = (await portal.fichasPrescritas(academia,aluno)).find((item) => item.id === fichaId);
  const registro = await transacao(async (client) => {
    await validarSessaoParaGravacao(client,vinculo,token);
    const { rows:[anterior] } = await client.query(`
      SELECT *,clock_timestamp() AS agora FROM aluno_portal_execucoes
      WHERE academia_id=$1 AND aluno_id=$2 AND (id=$3 OR estado <> 'finalizado')
      ORDER BY (id=$3) DESC LIMIT 1
    `,[academia,aluno,chave]);
    if (anterior) {
      if (anterior.id !== chave.toLowerCase()) {
        throw erro(409,'Já existe um treino em aberto. Retome ou finalize essa sessão.');
      }
      if (anterior.ficha_id !== fichaId) throw erro(409,'A solicitação foi usada para outra ficha.');
      return anterior;
    }
    if (!ficha) throw erro(404,'Ficha de treino não encontrada.');
    if (!ficha.exercicios.length) throw erro(400,'A ficha ainda não tem exercícios.');
    const cargas = await ultimasCargas(client,academia,aluno,[...new Set(ficha.exercicios.map(chaveExercicio))]);
    const copia = {
      nome:ficha.nome,
      exercicios:ficha.exercicios.map(({ imagem_url:_imagem,...ex }) => ({
        ...ex, total_series:seriesPrevistas(ex), ultima_carga:cargas.get(chaveExercicio(ex)) ?? null,
      })),
    };
    const { rows:[criado] } = await client.query(`
      INSERT INTO aluno_portal_execucoes(academia_id,aluno_id,id,ficha_id,prescricao)
      VALUES($1,$2,$3,$4,$5) RETURNING *,clock_timestamp() AS agora
    `,[academia,aluno,chave,fichaId,copia]);
    return criado;
  });
  return detalhe(registro,academia);
}

function proximo(row,comando) {
  const { acao, exercicio, serie, carga, repeticoes, segundos } = comando;
  const { agora, restante, duracao } = temporal(row);
  const itens = row.prescricao.exercicios;
  const ativo = row.estado === 'em_andamento';
  if (!ativo && !['retomar','finalizar'].includes(acao)) throw erro(409,'Retome o treino para continuar.');
  const estado = {
    series:{ ...row.series }, estado:row.estado, exercicio_atual:row.exercicio_atual,
    duracao_segundos:row.duracao_segundos, ativo_desde:row.ativo_desde, descanso_ate:row.descanso_ate,
    descanso_pausado_ms:row.descanso_pausado_ms, finalizado_em:null,
  };
  switch (acao) {
    case 'pausar':
      return { ...estado, estado:'pausado', duracao_segundos:duracao, ativo_desde:null,
        descanso_ate:null, descanso_pausado_ms:restante };
    case 'retomar':
      if (ativo) return estado;
      return { ...estado, estado:'em_andamento', ativo_desde:new Date(agora),
        descanso_ate:restante > 0 ? new Date(agora+restante) : null, descanso_pausado_ms:null };
    case 'finalizar':
      return { ...estado, estado:'finalizado', finalizado_em:new Date(agora), duracao_segundos:duracao,
        ativo_desde:null, descanso_ate:null, descanso_pausado_ms:null };
    case 'descanso':
      if (!inteiro(segundos,0,1800)) throw erro(400,'Informe um descanso de até 30 minutos.');
      estado.descanso_ate = segundos ? new Date(agora+segundos*1000) : null;
      return estado;
    default:
      if (!inteiro(exercicio,0,itens.length-1)) throw erro(400,'Exercício inválido.');
      if (acao === 'navegar') return { ...estado, exercicio_atual:exercicio };
      if (!inteiro(serie,1,itens[exercicio].total_series)) throw erro(400,'Série inválida.');
      const posicao = exercicio + ':' + serie;
      if (acao === 'remover_serie') delete estado.series[posicao];
      else {
        if (typeof carga !== 'number' || !Number.isFinite(carga) || carga < 0 || carga > 5000 ||
            !inteiro(repeticoes,1,10000) || (segundos != null && !inteiro(segundos,0,1800))) {
          throw erro(400,'Confira a carga, as repetições e o descanso.');
        }
        estado.series[posicao] = { exercicio,serie,carga,repeticoes,chave:chaveExercicio(itens[exercicio]),versao:row.versao+1 };
        if (!row.series[posicao] && segundos > 0) estado.descanso_ate = new Date(agora+segundos*1000);
      }
      return estado;
  }
}

async function atualizar(vinculo,token,id,comando) {
  if (!uuid(id) || !uuid(comando.chave) || !inteiro(comando.versao,0,2147483646) ||
      !['pausar','retomar','finalizar','descanso','navegar','registrar_serie','remover_serie'].includes(comando.acao)) {
    throw erro(400,'Comando inválido.');
  }
  const { academia_id:academia,aluno_id:aluno } = vinculo;
  const atual = await transacao(async (client) => {
    await validarSessaoParaGravacao(client,vinculo,token);
    const { rows:[row] } = await client.query(`
      SELECT *,clock_timestamp() AS agora FROM aluno_portal_execucoes
      WHERE academia_id=$1 AND aluno_id=$2 AND id=$3 FOR UPDATE
    `,[academia,aluno,id]);
    if (!row) throw erro(404,'Sessão de treino não encontrada.');
    if (row.ultima_operacao === comando.chave.toLowerCase() || (row.estado === 'finalizado' && comando.acao === 'finalizar')) return row;
    if (row.versao !== comando.versao || row.estado === 'finalizado') {
      throw erro(409,'O treino mudou em outra aba ou dispositivo. Atualize a sessão e tente novamente.');
    }
    const prox = proximo(row,comando);
    const { rows:[salvo] } = await client.query(`
      UPDATE aluno_portal_execucoes SET series=$5,estado=$6,exercicio_atual=$7,duracao_segundos=$8,
        ativo_desde=$9,descanso_ate=$10,descanso_pausado_ms=$11,finalizado_em=$12,
        versao=versao+1,ultima_operacao=$4
      WHERE academia_id=$1 AND aluno_id=$2 AND id=$3 RETURNING *,clock_timestamp() AS agora
    `,[academia,aluno,id,comando.chave,prox.series,prox.estado,prox.exercicio_atual,prox.duracao_segundos,
      prox.ativo_desde,prox.descanso_ate,prox.descanso_pausado_ms,prox.finalizado_em]);
    return salvo;
  });
  return detalhe(atual,academia);
}

async function listar(academia,aluno,pagina,incluirAberta) {
  if (!paginaValida(pagina)) throw erro(400,'Página inválida.');
  const [aberta,{ rows:historico }] = await Promise.all([
    incluirAberta ? consulta(`
      SELECT *,clock_timestamp() AS agora FROM aluno_portal_execucoes
      WHERE academia_id=$1 AND aluno_id=$2 AND estado <> 'finalizado'
    `,[academia,aluno]) : null,
    consulta(`
      SELECT *,clock_timestamp() AS agora FROM aluno_portal_execucoes
      WHERE academia_id=$1 AND aluno_id=$2 AND estado='finalizado'
      ORDER BY finalizado_em DESC,id DESC LIMIT $3 OFFSET $4
    `,[academia,aluno,porPagina+1,(Number(pagina)-1)*porPagina]),
  ]);
  const sessao = aberta?.rows[0];
  return { aberta:sessao ? await detalhe(sessao,academia) : null,
    historico:historico.slice(0,porPagina).map(resumo), tem_mais:historico.length > porPagina };
}

async function consultar(academia,aluno,id,finalizadoApenas = false) {
  if (!uuid(id)) throw erro(400,'Sessão de treino inválida.');
  const { rows:[row] } = await consulta(`
    SELECT *,clock_timestamp() AS agora FROM aluno_portal_execucoes
    WHERE academia_id=$1 AND aluno_id=$2 AND id=$3 AND (NOT $4::boolean OR estado='finalizado')
  `,[academia,aluno,id,finalizadoApenas]);
  if (!row) throw erro(404,'Sessão de treino não encontrada.');
  return detalhe(row,academia);
}

async function autorizarAcompanhamento(usuario,permissoes,aluno) {
  const professor = usuario.cargo === 'professor';
  if (usuario.cargo !== 'admin' && (!professor || !acesso(permissoes,'alunos','visualizar') ||
      !acesso(permissoes,'execucoes','visualizar'))) throw erro(403,'Acesso restrito ao acompanhamento.');
  const { rowCount } = await consulta(`
    SELECT 1 FROM alunos a LEFT JOIN aluno_portal_acessos p ON p.academia_id=a.academia_id AND p.aluno_id=a.id
    WHERE a.academia_id=$1 AND a.id=$2 AND ($3::integer IS NULL OR p.professor_id=$3)
  `,[usuario.academia_id,aluno,professor ? usuario.id : null]);
  if (!rowCount) throw erro(404,'Aluno não encontrado.');
}

module.exports = { pronto, iniciar, atualizar, listar, consultar, autorizarAcompanhamento };
