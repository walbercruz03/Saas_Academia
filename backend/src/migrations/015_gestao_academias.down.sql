BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM academias WHERE responsavel_nome IS NOT NULL OR responsavel_telefone IS NOT NULL
      OR ativar_apos_convite OR excluida_em IS NOT NULL)
    OR EXISTS (SELECT 1 FROM wcfit_assinaturas WHERE dias_teste <> 30)
  THEN RAISE EXCEPTION 'A reversão perderia dados de gerenciamento de academias.';
  END IF;
END $$;
ALTER TABLE wcfit_assinaturas DROP CONSTRAINT wcfit_assinaturas_periodo_teste, DROP COLUMN dias_teste,
  ADD CONSTRAINT wcfit_assinaturas_check CHECK (fim_teste = inicio_teste + 30);
ALTER TABLE academias DROP CONSTRAINT academias_exclusao_logica_inativa,
  DROP COLUMN responsavel_nome, DROP COLUMN responsavel_telefone, DROP COLUMN ativar_apos_convite, DROP COLUMN excluida_em;
COMMIT;
