BEGIN;
ALTER TABLE academias
  ADD COLUMN responsavel_nome text,
  ADD COLUMN responsavel_telefone text,
  ADD COLUMN ativar_apos_convite boolean NOT NULL DEFAULT false,
  ADD COLUMN excluida_em timestamptz,
  ADD CONSTRAINT academias_exclusao_logica_inativa CHECK (excluida_em IS NULL OR (ativo IS NOT DISTINCT FROM 0 AND NOT ativar_apos_convite));

ALTER TABLE wcfit_assinaturas ADD COLUMN dias_teste smallint NOT NULL DEFAULT 30 CHECK (dias_teste IN (0,30));
ALTER TABLE wcfit_assinaturas DROP CONSTRAINT wcfit_assinaturas_check,
  ADD CONSTRAINT wcfit_assinaturas_periodo_teste CHECK (fim_teste = inicio_teste + dias_teste);
COMMIT;
