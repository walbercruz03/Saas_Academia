BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM aluno_portal_acessos WHERE meta_semanal IS NOT NULL) THEN
    RAISE EXCEPTION 'A migration 020 contém metas semanais. Preserve os registros antes de reverter.';
  END IF;
END;
$$;
ALTER TABLE aluno_portal_acessos DROP COLUMN meta_semanal;
COMMIT;
