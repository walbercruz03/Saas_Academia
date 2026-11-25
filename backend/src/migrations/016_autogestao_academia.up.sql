BEGIN;
CREATE TABLE professor_permissoes (
  usuario_id integer PRIMARY KEY REFERENCES usuarios(id) ON DELETE RESTRICT,
  academia_id integer NOT NULL REFERENCES academias(id) ON DELETE RESTRICT,
  permissoes jsonb NOT NULL CHECK (jsonb_typeof(permissoes) = 'object'),
  alterado_por integer NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  atualizado_em timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE wcfit_autogestao (
  academia_id integer PRIMARY KEY REFERENCES wcfit_assinaturas(academia_id),
  consentido_em timestamptz,
  consentido_por integer REFERENCES usuarios(id),
  preco_centavos integer CHECK (preco_centavos > 0),
  autorizado_em timestamptz,
  autorizado_por integer REFERENCES usuarios(id),
  meio text CHECK (meio IN ('PIX','CREDIT_CARD')),
  checkout_referencia text UNIQUE,
  checkout_id text UNIQUE,
  checkout_encerrado_em timestamptz,
  checkout_incerto boolean NOT NULL DEFAULT false,
  cancelamento_solicitado_em timestamptz,
  cancelado_em timestamptz,
  acesso_ate date,
  CHECK (cancelado_em IS NULL OR (cancelamento_solicitado_em IS NOT NULL AND acesso_ate IS NOT NULL))
);
COMMIT;
