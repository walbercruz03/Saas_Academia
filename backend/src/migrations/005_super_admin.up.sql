BEGIN;
CREATE TABLE super_admin_identidade (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  totp_cifrado text,
  ultimo_passo_totp bigint,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE super_admin_sessoes (
  token_hash text PRIMARY KEY,
  proprietario_id smallint NOT NULL REFERENCES super_admin_identidade(id),
  etapa text NOT NULL CHECK (etapa IN ('configurar', 'validar', 'autenticada')),
  totp_pendente text,
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE super_admin_recuperacao (
  codigo_hash text PRIMARY KEY,
  proprietario_id smallint NOT NULL REFERENCES super_admin_identidade(id),
  usado_em timestamptz
);
CREATE TABLE super_admin_limites (
  escopo text PRIMARY KEY,
  inicio timestamptz NOT NULL,
  tentativas integer NOT NULL CHECK (tentativas > 0)
);
CREATE TABLE super_admin_auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proprietario_id smallint REFERENCES super_admin_identidade(id),
  evento text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
COMMIT;
