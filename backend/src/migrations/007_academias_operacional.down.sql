BEGIN;
LOCK TABLE academias, academias_historico_operacional IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM academias_historico_operacional)
     OR EXISTS (SELECT 1 FROM academias WHERE versao_sessao <> 0) THEN
    RAISE EXCEPTION 'Reversão recusada: preserve o histórico e as versões de sessão após entrada em uso.';
  END IF;
END $$;
DROP TABLE academias_historico_operacional;
ALTER TABLE academias DROP COLUMN versao_sessao;
COMMIT;
