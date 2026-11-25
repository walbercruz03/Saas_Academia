BEGIN;

CREATE TABLE wcfit_precos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  vigente_desde timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO wcfit_precos (valor_centavos) VALUES (7999);

CREATE TABLE wcfit_assinaturas (
  academia_id integer PRIMARY KEY REFERENCES academias(id),
  preco_id integer REFERENCES wcfit_precos(id),
  mensalidade_centavos integer NOT NULL CHECK (mensalidade_centavos > 0),
  inicio_teste date NOT NULL,
  fim_teste date NOT NULL CHECK (fim_teste = inicio_teste + 30),
  dia_vencimento smallint NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  proximo_vencimento date NOT NULL CHECK (proximo_vencimento >= fim_teste),
  provedor text,
  cliente_externo_id text,
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((provedor IS NULL) = (cliente_externo_id IS NULL))
);

INSERT INTO wcfit_assinaturas (academia_id, mensalidade_centavos, inicio_teste, fim_teste, dia_vencimento, proximo_vencimento)
SELECT a.id, a.mensalidade_centavos, t.inicio, t.inicio + 30, extract(day FROM t.inicio + 30), t.inicio + 30
FROM academias a
CROSS JOIN LATERAL (SELECT (a.teste_gratuito_iniciado_em AT TIME ZONE 'America/Fortaleza')::date AS inicio) t
WHERE a.tipo_cadastro IS NOT NULL AND t.inicio IS NOT NULL AND a.mensalidade_centavos IS NOT NULL;

CREATE TABLE wcfit_cortesias (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academia_id integer NOT NULL REFERENCES wcfit_assinaturas(academia_id),
  concedida_em date NOT NULL,
  ate date CHECK (ate >= concedida_em),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 240),
  vencimento_anterior date NOT NULL,
  revogada_em date,
  motivo_revogacao text,
  CHECK ((revogada_em IS NULL) = (motivo_revogacao IS NULL)),
  CHECK (revogada_em IS NULL OR revogada_em >= concedida_em),
  CHECK (motivo_revogacao IS NULL OR char_length(btrim(motivo_revogacao)) BETWEEN 1 AND 240)
);
CREATE INDEX wcfit_cortesias_academia_idx ON wcfit_cortesias (academia_id, id DESC);

CREATE TABLE wcfit_recebimentos (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academia_id integer NOT NULL REFERENCES wcfit_assinaturas(academia_id),
  competencia date NOT NULL,
  recebido_em date NOT NULL,
  valor_centavos integer NOT NULL CHECK (valor_centavos > 0),
  referencia text CHECK (char_length(referencia) <= 120),
  provedor text,
  pagamento_externo_id text,
  chave_hash bytea NOT NULL UNIQUE CHECK (octet_length(chave_hash) = 32),
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (academia_id, competencia),
  UNIQUE (provedor, pagamento_externo_id),
  CHECK ((provedor IS NULL) = (pagamento_externo_id IS NULL))
);
CREATE INDEX wcfit_recebimentos_data_idx ON wcfit_recebimentos (recebido_em);

COMMIT;
