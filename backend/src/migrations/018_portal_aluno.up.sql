BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- O CPF identifica um vínculo dentro da academia. A criação do índice
-- interrompe a migration se houver cadastros locais conflitantes.
CREATE UNIQUE INDEX alunos_academia_cpf_portal_idx ON alunos (
  academia_id, regexp_replace(cpf, '[^0-9]', '', 'g')
) WHERE length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11;
CREATE INDEX alunos_cpf_portal_busca_idx ON alunos (regexp_replace(cpf, '[^0-9]', '', 'g'))
  WHERE length(regexp_replace(cpf, '[^0-9]', '', 'g')) = 11;
ALTER TABLE alunos DROP CONSTRAINT IF EXISTS alunos_cpf_key;
CREATE UNIQUE INDEX alunos_academia_id_portal_idx ON alunos (academia_id, id);

CREATE TABLE aluno_portal_acessos (
  academia_id integer NOT NULL,
  aluno_id integer NOT NULL,
  professor_id integer REFERENCES usuarios(id) ON DELETE SET NULL,
  objetivo text CHECK (char_length(objetivo) <= 500),
  bloqueado boolean NOT NULL DEFAULT true,
  senha_hash text,
  codigo_hash text UNIQUE,
  codigo_expira_em timestamptz,
  PRIMARY KEY (academia_id, aluno_id),
  FOREIGN KEY (academia_id, aluno_id) REFERENCES alunos(academia_id, id) ON DELETE CASCADE,
  CHECK ((codigo_hash IS NULL) = (codigo_expira_em IS NULL))
);

CREATE TABLE aluno_portal_sessoes (
  token_hash text PRIMARY KEY,
  academia_id integer NOT NULL,
  aluno_id integer NOT NULL,
  expira_em timestamptz NOT NULL,
  FOREIGN KEY (academia_id, aluno_id) REFERENCES aluno_portal_acessos(academia_id, aluno_id) ON DELETE CASCADE
);
CREATE INDEX aluno_portal_sessoes_vinculo_idx ON aluno_portal_sessoes (academia_id, aluno_id);
CREATE INDEX aluno_portal_sessoes_expira_idx ON aluno_portal_sessoes (expira_em);

CREATE FUNCTION revogar_portal_ao_alterar_aluno() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE aluno_portal_acessos SET bloqueado=true, senha_hash=NULL,
    codigo_hash=NULL, codigo_expira_em=NULL WHERE academia_id=OLD.academia_id AND aluno_id=OLD.id;
  DELETE FROM aluno_portal_sessoes WHERE academia_id=OLD.academia_id AND aluno_id=OLD.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER alunos_revogar_portal
  AFTER UPDATE OF cpf, status ON alunos FOR EACH ROW
  WHEN (regexp_replace(OLD.cpf, '[^0-9]', '', 'g') IS DISTINCT FROM regexp_replace(NEW.cpf, '[^0-9]', '', 'g')
    OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'inativo'))
  EXECUTE FUNCTION revogar_portal_ao_alterar_aluno();

ALTER TABLE exercicios ADD COLUMN portal_imagem_autorizada text;
COMMIT;
