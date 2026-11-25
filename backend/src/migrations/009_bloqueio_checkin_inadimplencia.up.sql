BEGIN;
ALTER TABLE academias
  ADD COLUMN bloquear_checkin_inadimplencia boolean NOT NULL DEFAULT false,
  ADD COLUMN tolerancia_inadimplencia_dias integer NOT NULL DEFAULT 0
    CHECK (tolerancia_inadimplencia_dias >= 0);
COMMIT;
