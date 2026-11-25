BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM aluno_portal_execucoes) THEN
    RAISE EXCEPTION 'A migration 019 contém execuções. Preserve os registros antes de reverter.';
  END IF;
END;
$$;
DROP TABLE aluno_portal_execucoes;
COMMIT;
