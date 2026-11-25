BEGIN;
SET LOCAL search_path = public, pg_catalog;

ALTER TABLE academias ADD COLUMN checkin_facial_ativo boolean NOT NULL DEFAULT false;

CREATE TABLE aluno_biometrias_faciais (
  academia_id integer NOT NULL,
  aluno_id integer NOT NULL,
  descritor_versao text NOT NULL,
  chave_versao text NOT NULL,
  nonce bytea NOT NULL CHECK (octet_length(nonce) = 12),
  etiqueta bytea NOT NULL CHECK (octet_length(etiqueta) = 16),
  cifrado bytea NOT NULL CHECK (octet_length(cifrado) BETWEEN 1 AND 8192),
  aviso_versao text NOT NULL,
  consentido_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  expira_em timestamptz NOT NULL,
  PRIMARY KEY (academia_id, aluno_id),
  FOREIGN KEY (academia_id, aluno_id) REFERENCES alunos(academia_id,id) ON DELETE CASCADE,
  CHECK (expira_em > consentido_em)
);

CREATE INDEX aluno_biometrias_faciais_expira_idx ON aluno_biometrias_faciais (academia_id,expira_em);

COMMIT;
