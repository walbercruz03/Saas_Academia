DO $$
BEGIN
  RAISE EXCEPTION 'Reversão automática indisponível: preserve auditoria, exclusões lógicas e invalidação de sessões antigas.';
END $$;
