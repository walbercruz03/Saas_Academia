BEGIN;
LOCK TABLE wcfit_precos, wcfit_assinaturas, wcfit_cortesias, wcfit_recebimentos IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT FROM wcfit_recebimentos) OR EXISTS (SELECT FROM wcfit_cortesias)
     OR EXISTS (SELECT FROM wcfit_assinaturas WHERE preco_id IS NOT NULL)
     OR (SELECT count(*) FROM wcfit_precos) <> 1 THEN
    RAISE EXCEPTION 'Reversão recusada: preserve o histórico comercial.';
  END IF;
END $$;
DROP TABLE wcfit_recebimentos, wcfit_cortesias, wcfit_assinaturas, wcfit_precos;
COMMIT;
