BEGIN;
LOCK TABLE academias, cadastro_publico_verificacoes IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT FROM academias WHERE tipo_cadastro IS NOT NULL) THEN
    RAISE EXCEPTION 'Reversão recusada: preserve os cadastros públicos existentes.';
  END IF;
END $$;
ALTER TABLE academias
  ADD CONSTRAINT academias_nome_key UNIQUE (nome),
  DROP CONSTRAINT academias_documento_cadastro_formato,
  DROP COLUMN tipo_cadastro,
  DROP COLUMN documento_cadastro,
  DROP COLUMN unidade_cadastro,
  DROP COLUMN razao_social,
  DROP COLUMN cep,
  DROP COLUMN logradouro,
  DROP COLUMN numero_endereco,
  DROP COLUMN complemento,
  DROP COLUMN bairro,
  DROP COLUMN cidade,
  DROP COLUMN uf,
  DROP COLUMN email_responsavel_verificado_em,
  DROP COLUMN termos_aceitos_url,
  DROP COLUMN privacidade_aceita_url,
  DROP COLUMN teste_gratuito_iniciado_em,
  DROP COLUMN teste_gratuito_termina_em,
  DROP COLUMN mensalidade_centavos;
DROP TABLE cadastro_publico_verificacoes;
COMMIT;
