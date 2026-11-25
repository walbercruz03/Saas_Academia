BEGIN;
CREATE TABLE super_admin_convites (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academia_id integer NOT NULL REFERENCES academias(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 160),
  email text NOT NULL CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 1 AND 254),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  emissor_id smallint NOT NULL REFERENCES super_admin_identidade(id) ON DELETE RESTRICT,
  operacao_hash text NOT NULL CHECK (operacao_hash ~ '^[a-f0-9]{64}$'),
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  expira_em timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '24 hours'),
  revogado_em timestamptz,
  consumido_em timestamptz,
  usuario_id integer UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
  UNIQUE (emissor_id, operacao_hash),
  CHECK (expira_em > criado_em),
  CHECK ((usuario_id IS NULL) = (consumido_em IS NULL)),
  CHECK (revogado_em IS NULL OR consumido_em IS NULL)
);
-- A expiração é verificada nas consultas e na transação de emissão, nunca no predicado do índice.
CREATE UNIQUE INDEX super_admin_convites_um_aberto_email
  ON super_admin_convites(email) WHERE revogado_em IS NULL AND consumido_em IS NULL;
CREATE INDEX super_admin_convites_academia ON super_admin_convites(academia_id, id DESC);
COMMIT;
