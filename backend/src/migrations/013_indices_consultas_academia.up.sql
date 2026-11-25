-- Execute fora de uma transação para manter disponível a escrita nas tabelas.
CREATE INDEX CONCURRENTLY idx_checkins_academia_data_id
  ON checkins (academia_id, data_checkin DESC, id DESC);
CREATE INDEX CONCURRENTLY idx_alunos_academia_criado_id
  ON alunos (academia_id, criado_em DESC, id DESC);
CREATE INDEX CONCURRENTLY idx_matriculas_academia_aluno
  ON matriculas (academia_id, aluno_id);
