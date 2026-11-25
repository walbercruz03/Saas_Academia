BEGIN;
LOCK TABLE wcfit_asaas_sandbox_operacoes, wcfit_asaas_sandbox_eventos, wcfit_asaas_sandbox_cobrancas IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT FROM wcfit_asaas_sandbox_operacoes) OR EXISTS (SELECT FROM wcfit_asaas_sandbox_eventos) THEN
    RAISE EXCEPTION 'Reversão recusada: preserve as tentativas e os eventos do Sandbox.';
  END IF;
END $$;
DROP TABLE wcfit_asaas_sandbox_cobrancas, wcfit_asaas_sandbox_eventos, wcfit_asaas_sandbox_operacoes;
COMMIT;
