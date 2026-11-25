BEGIN;
ALTER TABLE usuarios ADD COLUMN excluido_em timestamptz,
  ADD CONSTRAINT usuarios_exclusao_logica_inativa CHECK (excluido_em IS NULL OR status = 'inativo');
ALTER TABLE super_admin_sessoes ADD COLUMN totp_confirmado_em timestamptz;
DELETE FROM super_admin_sessoes;
CREATE TABLE usuario_sessoes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id),
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  expira_em timestamptz NOT NULL,
  revogada_em timestamptz
);
CREATE INDEX usuario_sessoes_usuario_idx ON usuario_sessoes (usuario_id,id DESC);
CREATE TABLE usuario_verificacoes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id),
  tipo text NOT NULL CHECK (tipo IN ('email','senha')),
  email_destino text NOT NULL,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  criada_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  expira_em timestamptz NOT NULL,
  encerrada_em timestamptz
);
CREATE UNIQUE INDEX usuario_verificacoes_aberta_idx ON usuario_verificacoes (usuario_id,tipo) WHERE encerrada_em IS NULL;
CREATE INDEX usuarios_admin_ativo_academia_idx ON usuarios (academia_id)
  WHERE cargo='admin' AND status='ativo' AND excluido_em IS NULL;
COMMIT;
