BEGIN;

CREATE TABLE operacoes_idempotentes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academia_id integer NOT NULL REFERENCES academias(id),
  solicitante_id integer NOT NULL REFERENCES usuarios(id),
  tipo_operacao text NOT NULL CHECK (tipo_operacao IN ('criar_matricula', 'renovar_matricula', 'registrar_checkin')),
  chave_hash bytea NOT NULL CHECK (octet_length(chave_hash) = 32),
  parametros_versao text NOT NULL CHECK (parametros_versao ~ '^[a-zA-Z0-9_-]{1,32}$'),
  parametros_hmac bytea NOT NULL CHECK (octet_length(parametros_hmac) = 32),
  resultado_tipo text NOT NULL,
  resultado_id integer NOT NULL CHECK (resultado_id > 0),
  status_http smallint NOT NULL CHECK (status_http = 201),
  recibo jsonb NOT NULL CHECK (recibo = jsonb_build_object('id', resultado_id)),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academia_id, solicitante_id, tipo_operacao, chave_hash),
  CHECK (resultado_tipo = CASE WHEN tipo_operacao = 'registrar_checkin' THEN 'checkin' ELSE 'matricula' END)
);

CREATE INDEX idx_operacoes_idempotentes_solicitante ON operacoes_idempotentes (solicitante_id);
COMMIT;
