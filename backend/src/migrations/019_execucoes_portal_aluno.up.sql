BEGIN;
SET LOCAL search_path = public, pg_catalog;

CREATE TABLE aluno_portal_execucoes (
  academia_id integer NOT NULL,
  aluno_id integer NOT NULL,
  id uuid NOT NULL,
  ficha_id text NOT NULL,
  prescricao jsonb NOT NULL CHECK (jsonb_typeof(prescricao) = 'object'),
  series jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(series) = 'object'),
  estado text NOT NULL DEFAULT 'em_andamento' CHECK (estado IN ('em_andamento', 'pausado', 'finalizado')),
  versao integer NOT NULL DEFAULT 0 CHECK (versao >= 0),
  ultima_operacao uuid,
  exercicio_atual integer NOT NULL DEFAULT 0 CHECK (exercicio_atual >= 0),
  iniciado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  ativo_desde timestamptz DEFAULT clock_timestamp(),
  finalizado_em timestamptz,
  duracao_segundos integer NOT NULL DEFAULT 0 CHECK (duracao_segundos >= 0),
  descanso_ate timestamptz,
  descanso_pausado_ms integer CHECK (descanso_pausado_ms BETWEEN 0 AND 1800000),
  PRIMARY KEY (academia_id, aluno_id, id),
  FOREIGN KEY (academia_id, aluno_id) REFERENCES alunos(academia_id, id) ON DELETE CASCADE,
  CHECK ((estado = 'em_andamento') = (ativo_desde IS NOT NULL)),
  CHECK ((estado = 'finalizado') = (finalizado_em IS NOT NULL)),
  CHECK (descanso_ate IS NULL OR estado = 'em_andamento'),
  CHECK (descanso_pausado_ms IS NULL OR estado = 'pausado')
);

CREATE UNIQUE INDEX aluno_portal_execucoes_uma_aberta_idx
  ON aluno_portal_execucoes (academia_id, aluno_id) WHERE estado <> 'finalizado';

CREATE INDEX aluno_portal_execucoes_historico_idx
  ON aluno_portal_execucoes (academia_id, aluno_id, finalizado_em DESC, id DESC)
  WHERE estado = 'finalizado';

COMMIT;
