BEGIN;
ALTER TABLE academias ADD COLUMN versao_sessao bigint NOT NULL DEFAULT 0 CHECK (versao_sessao >= 0);

CREATE TABLE academias_historico_operacional (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academia_id integer NOT NULL REFERENCES academias(id) ON DELETE RESTRICT,
  proprietario_id smallint NOT NULL REFERENCES super_admin_identidade(id) ON DELETE RESTRICT,
  operacao text NOT NULL CHECK (operacao IN ('ativar', 'suspender', 'reativar', 'regularizar')),
  estado_anterior text NOT NULL,
  estado_novo text NOT NULL,
  motivo text CHECK (motivo IS NULL OR char_length(btrim(motivo)) BETWEEN 1 AND 500),
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  operacao_hash text NOT NULL CHECK (operacao_hash ~ '^[a-f0-9]{64}$'),
  versao_anterior bigint NOT NULL CHECK (versao_anterior >= 0),
  versao_posterior bigint NOT NULL,
  UNIQUE (proprietario_id, operacao_hash),
  CHECK (
    (operacao = 'suspender' AND estado_anterior = 'ativa' AND estado_novo = 'suspensa'
      AND versao_posterior = versao_anterior + 1 AND motivo IS NOT NULL)
    OR (operacao = 'regularizar' AND estado_anterior = 'inativa_indeterminada' AND estado_novo = 'ativa'
      AND versao_posterior = versao_anterior + 1 AND motivo IS NOT NULL)
    OR (estado_novo = 'ativa' AND versao_posterior = versao_anterior AND (
      (operacao = 'ativar' AND estado_anterior = 'aguardando_ativacao')
      OR (operacao = 'reativar' AND estado_anterior = 'suspensa' AND motivo IS NOT NULL)
    ))
  )
);
CREATE INDEX academias_historico_operacional_academia ON academias_historico_operacional(academia_id, id DESC);
COMMIT;
