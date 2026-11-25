BEGIN;
SET LOCAL search_path = public, pg_catalog;
ALTER TABLE aluno_portal_acessos ADD COLUMN meta_semanal smallint
  CHECK (meta_semanal BETWEEN 1 AND 21);
COMMIT;
