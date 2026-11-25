BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT FROM professor_permissoes) OR EXISTS (SELECT FROM wcfit_autogestao)
  THEN RAISE EXCEPTION 'A reversão perderia permissões ou histórico comercial.';
  END IF;
END $$;
DROP TABLE wcfit_autogestao;
DROP TABLE professor_permissoes;
COMMIT;
