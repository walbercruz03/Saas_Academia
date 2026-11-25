BEGIN;

CREATE TABLE wcfit_asaas_sandbox_operacoes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academia_id integer NOT NULL REFERENCES wcfit_assinaturas(academia_id),
  namespace text NOT NULL CHECK (namespace ~ '^[a-z0-9-]{4,32}$'),
  tipo text NOT NULL CHECK (tipo IN ('cliente', 'assinatura')),
  estado text NOT NULL CHECK (estado IN ('enviando','incerta','vinculada','cancelando','cancelada','rejeitada')),
  externo_id text UNIQUE,
  cliente_id text,
  vencimento_inicial date,
  valor_centavos integer CHECK (valor_centavos > 0),
  meio text CHECK (meio IN ('UNDEFINED','PIX','BOLETO','CREDIT_CARD')),
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  atualizado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((estado IN ('vinculada','cancelando','cancelada')) = (externo_id IS NOT NULL)),
  CHECK (tipo <> 'cliente' OR estado NOT IN ('cancelando','cancelada')),
  CHECK (
    (tipo = 'cliente' AND cliente_id IS NULL AND vencimento_inicial IS NULL AND valor_centavos IS NULL AND meio IS NULL)
    OR (tipo = 'assinatura' AND cliente_id IS NOT NULL AND vencimento_inicial IS NOT NULL AND valor_centavos IS NOT NULL AND meio IS NOT NULL)
  ),
  UNIQUE (id, academia_id)
);
CREATE UNIQUE INDEX wcfit_asaas_sandbox_operacao_viva
  ON wcfit_asaas_sandbox_operacoes(academia_id,tipo)
  WHERE estado IN ('enviando','incerta','vinculada','cancelando');

CREATE TABLE wcfit_asaas_sandbox_eventos (
  namespace text NOT NULL CHECK (namespace ~ '^[a-z0-9-]{4,32}$'),
  evento_id text NOT NULL,
  tipo text NOT NULL,
  recurso_id text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  tentar_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  processado_em timestamptz,
  tentativas smallint NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 12),
  PRIMARY KEY (namespace,evento_id)
);
CREATE INDEX wcfit_asaas_sandbox_eventos_pendentes
  ON wcfit_asaas_sandbox_eventos(namespace,tentar_em,criado_em) WHERE processado_em IS NULL AND tentativas < 12;

CREATE TABLE wcfit_asaas_sandbox_cobrancas (
  externo_id text PRIMARY KEY,
  academia_id integer NOT NULL,
  assinatura_id integer NOT NULL,
  vencimento date,
  recebido_em date,
  status text NOT NULL,
  recebido_gateway boolean NOT NULL DEFAULT false,
  valor_centavos bigint CHECK (valor_centavos >= 0),
  estornado_centavos bigint CHECK (estornado_centavos >= 0),
  meio text,
  atualizado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (assinatura_id, academia_id) REFERENCES wcfit_asaas_sandbox_operacoes(id, academia_id)
);
CREATE INDEX wcfit_asaas_sandbox_cobrancas_academia ON wcfit_asaas_sandbox_cobrancas(academia_id,vencimento);

COMMIT;
