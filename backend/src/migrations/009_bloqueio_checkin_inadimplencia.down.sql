BEGIN;
ALTER TABLE academias
  DROP COLUMN bloquear_checkin_inadimplencia,
  DROP COLUMN tolerancia_inadimplencia_dias;
COMMIT;
