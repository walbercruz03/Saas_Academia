const { consulta } = require('../models/SuperAdmin');
const { getDataHojeFortaleza } = require('../utils/datasFortaleza');

const erro = (status,mensagem) => Object.assign(new Error(mensagem),{status});

async function consultar(academia,aluno,periodo,exercicio) {
  if (!['7','30','90'].includes(periodo) || (exercicio != null &&
      (typeof exercicio !== 'string' || !exercicio.length || exercicio.length > 1024))) {
    throw erro(400,'Confira o período e o exercício.');
  }
  const hoje = getDataHojeFortaleza();
  const params = [academia,aluno,hoje,Number(periodo)];
  const intervalo = `
    SELECT ($3::date - ($4::int-1)) AS inicio, $3::date AS fim,
      date_trunc('week',$3::timestamp)::date AS segunda
  `;
  const finalizadas = `
    SELECT e.*, (e.finalizado_em AT TIME ZONE 'America/Fortaleza')::date AS dia
    FROM aluno_portal_execucoes e CROSS JOIN periodo p
    WHERE e.academia_id=$1 AND e.aluno_id=$2 AND e.estado='finalizado'
      AND e.finalizado_em >= (p.inicio::timestamp AT TIME ZONE 'America/Fortaleza')
      AND e.finalizado_em < ((p.fim+1)::timestamp AT TIME ZONE 'America/Fortaleza')
  `;
  const [atividade,movimentos,orientacao] = await Promise.all([
    consulta(`
      WITH periodo AS (${intervalo}), sessoes AS (${finalizadas}),
      dias AS (SELECT dia,count(*)::int AS treinos FROM sessoes GROUP BY dia)
      SELECT p.inicio::text,p.fim::text,p.segunda::text,
        (SELECT count(*)::int FROM sessoes) AS treinos,
        (SELECT count(*)::int FROM dias) AS dias_treinados,
        (SELECT coalesce(sum(duracao_segundos),0)::float8 FROM sessoes) AS segundos,
        (SELECT count(*)::int FROM sessoes WHERE dia>=p.segunda) AS treinos_semana,
        coalesce((SELECT jsonb_agg(jsonb_build_object('dia',dia,'treinos',treinos) ORDER BY dia) FROM dias),'[]') AS calendario
      FROM periodo p
    `,params),
    consulta(`
      WITH periodo AS (${intervalo}), sessoes AS (${finalizadas}), registros AS (
        SELECT e.dia,e.finalizado_em,r.valor->>'chave' AS chave,
          e.prescricao->'exercicios'->((r.valor->>'exercicio')::int)->>'nome' AS nome,
          (r.valor->>'carga')::numeric AS carga, (r.valor->>'repeticoes')::int AS repeticoes
        FROM sessoes e CROSS JOIN LATERAL jsonb_each(e.series) AS r(serie,valor)
      ), opcoes AS (
        SELECT DISTINCT ON (chave) chave,nome FROM registros WHERE chave IS NOT NULL AND nome IS NOT NULL
        ORDER BY chave,finalizado_em DESC,nome
      ), escolha AS (
        SELECT chave FROM opcoes ORDER BY (chave=$5) DESC NULLS LAST,nome,chave LIMIT 1
      ), diario AS (
        SELECT dia,max(carga) AS carga,max(repeticoes) AS repeticoes FROM registros
        WHERE chave=(SELECT chave FROM escolha) GROUP BY dia
      ), recordes AS (
        SELECT max((r.valor->>'carga')::numeric)::float8 AS carga,
          max((r.valor->>'repeticoes')::int) AS repeticoes
        FROM aluno_portal_execucoes e CROSS JOIN LATERAL jsonb_each(e.series) AS r(serie,valor)
        WHERE e.academia_id=$1 AND e.aluno_id=$2 AND e.estado='finalizado'
          AND r.valor->>'chave'=(SELECT chave FROM escolha)
      )
      SELECT (SELECT chave FROM escolha) AS exercicio,
        coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY nome,chave) FROM opcoes o),'[]') AS exercicios,
        coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY dia) FROM diario d),'[]') AS pontos,
        (SELECT carga FROM recordes) AS melhor_carga,
        (SELECT repeticoes FROM recordes) AS melhores_repeticoes
    `,[...params,exercicio ?? null]),
    consulta(`
      SELECT p.objetivo,(to_jsonb(p)->>'meta_semanal')::int AS meta_semanal
      FROM aluno_portal_acessos p WHERE p.academia_id=$1 AND p.aluno_id=$2
    `,[academia,aluno]),
  ]);
  return { ...atividade.rows[0], ...movimentos.rows[0],
    objetivo:orientacao.rows[0]?.objetivo ?? null, meta_semanal:orientacao.rows[0]?.meta_semanal ?? null };
}

async function salvarMeta(usuario,aluno,meta) {
  if (meta !== null && (!Number.isInteger(meta) || meta < 1 || meta > 21)) {
    throw erro(400,'Informe uma meta de 1 a 21 treinos por semana ou remova a meta.');
  }
  const professor = usuario.cargo === 'professor';
  const { rows:[estrutura] } = await consulta(`
    SELECT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.aluno_portal_acessos')
      AND attname='meta_semanal' AND NOT attisdropped) AS disponivel
  `);
  if (!estrutura.disponivel) throw erro(503,'A configuração de metas ainda está indisponível.');
  const { rowCount } = await (professor ? consulta(`
    UPDATE aluno_portal_acessos SET meta_semanal=$4
    WHERE academia_id=$1 AND aluno_id=$2 AND professor_id=$3
  `,[usuario.academia_id,aluno,usuario.id,meta]) : consulta(`
    INSERT INTO aluno_portal_acessos(academia_id,aluno_id,meta_semanal)
    SELECT academia_id,id,$3 FROM alunos WHERE academia_id=$1 AND id=$2
    ON CONFLICT (academia_id,aluno_id) DO UPDATE SET meta_semanal=EXCLUDED.meta_semanal
  `,[usuario.academia_id,aluno,meta]));
  if (!rowCount) throw erro(404,'Aluno não encontrado.');
}

module.exports = { consultar,salvarMeta };
