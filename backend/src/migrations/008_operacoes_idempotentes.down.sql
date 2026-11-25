BEGIN;
LOCK TABLE operacoes_idempotentes IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM operacoes_idempotentes) THEN
    RAISE EXCEPTION 'Reversão recusada: preserve os recibos idempotentes após entrada em uso.';
  END IF;
END $$;
DROP TABLE operacoes_idempotentes;
COMMIT;
