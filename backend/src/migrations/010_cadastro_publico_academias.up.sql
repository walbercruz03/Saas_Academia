BEGIN;

ALTER TABLE academias
  DROP CONSTRAINT IF EXISTS academias_nome_key,
  ADD COLUMN tipo_cadastro text CHECK (tipo_cadastro IN ('mei', 'empresa', 'pessoa_fisica')),
  ADD COLUMN documento_cadastro text,
  ADD COLUMN unidade_cadastro text,
  ADD COLUMN razao_social text,
  ADD COLUMN cep text,
  ADD COLUMN logradouro text,
  ADD COLUMN numero_endereco text,
  ADD COLUMN complemento text,
  ADD COLUMN bairro text,
  ADD COLUMN cidade text,
  ADD COLUMN uf text,
  ADD COLUMN email_responsavel_verificado_em timestamptz,
  ADD COLUMN termos_aceitos_url text,
  ADD COLUMN privacidade_aceita_url text,
  ADD COLUMN teste_gratuito_iniciado_em timestamptz,
  ADD COLUMN teste_gratuito_termina_em timestamptz,
  ADD COLUMN mensalidade_centavos integer CHECK (mensalidade_centavos > 0),
  ADD CONSTRAINT academias_documento_cadastro_formato CHECK (
    (tipo_cadastro IS NULL AND documento_cadastro IS NULL AND unidade_cadastro IS NULL)
    OR (tipo_cadastro IS NOT NULL AND documento_cadastro IS NOT NULL AND unidade_cadastro IS NOT NULL
        AND CASE WHEN tipo_cadastro = 'pessoa_fisica' THEN documento_cadastro ~ '^[0-9]{11}$'
            ELSE documento_cadastro ~ '^[A-Z0-9]{12}[0-9]{2}$' END)
  );

CREATE UNIQUE INDEX academias_documento_unidade_cadastro_key
  ON academias (documento_cadastro, unidade_cadastro) WHERE documento_cadastro IS NOT NULL;

CREATE TABLE cadastro_publico_verificacoes (
  email_hmac bytea PRIMARY KEY CHECK (octet_length(email_hmac) = 32),
  desafio_hash bytea NOT NULL CHECK (octet_length(desafio_hash) = 32),
  codigo_hmac bytea NOT NULL CHECK (octet_length(codigo_hmac) = 32),
  criado_em timestamptz NOT NULL,
  expira_em timestamptz NOT NULL,
  tentativas smallint NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 5),
  consumido_em timestamptz
);

COMMIT;
