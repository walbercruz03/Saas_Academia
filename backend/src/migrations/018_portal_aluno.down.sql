BEGIN;
SET LOCAL search_path = public, pg_catalog;
-- A restrição antiga é restaurada apenas se os dados forem compatíveis.
ALTER TABLE alunos ADD CONSTRAINT alunos_cpf_key UNIQUE (cpf);
ALTER TABLE exercicios DROP COLUMN portal_imagem_autorizada;
DROP TRIGGER alunos_revogar_portal ON alunos;
DROP FUNCTION revogar_portal_ao_alterar_aluno();
DROP TABLE aluno_portal_sessoes;
DROP TABLE aluno_portal_acessos;
DROP INDEX alunos_academia_id_portal_idx;
DROP INDEX alunos_academia_cpf_portal_idx;
DROP INDEX alunos_cpf_portal_busca_idx;
COMMIT;
