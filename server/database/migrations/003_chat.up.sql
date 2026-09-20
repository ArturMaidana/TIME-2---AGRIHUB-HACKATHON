ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK(role IN ('SUPERVISOR','RH','FUNCIONARIO'));

CREATE TABLE reclamacoes_sugestoes(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('RECLAMACAO','SUGESTAO')),
  mensagem TEXT NOT NULL CHECK(char_length(mensagem) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANALISE','TRATADO','DESCARTADO')),
  resposta_supervisor TEXT CHECK(resposta_supervisor IS NULL OR char_length(resposta_supervisor) BETWEEN 1 AND 2000),
  respondido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_reclamacoes_scope ON reclamacoes_sugestoes(unidade_id, setor_id, status);
CREATE INDEX idx_reclamacoes_usuario ON reclamacoes_sugestoes(usuario_id);
