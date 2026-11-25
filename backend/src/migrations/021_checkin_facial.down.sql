BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM aluno_biometrias_faciais) OR EXISTS (SELECT 1 FROM academias WHERE checkin_facial_ativo) THEN
    RAISE EXCEPTION 'Desative a biometria e trate os cadastros antes de reverter a migration 021.';
  END IF;
END;
$$;
DROP TABLE aluno_biometrias_faciais;
ALTER TABLE academias DROP COLUMN checkin_facial_ativo;
COMMIT;
