CREATE TABLE configuracoes_indicadores(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  peso_energia NUMERIC NOT NULL DEFAULT 0.30,
  peso_fisico NUMERIC NOT NULL DEFAULT 0.20,
  peso_emocional NUMERIC NOT NULL DEFAULT 0.20,
  peso_faltas NUMERIC NOT NULL DEFAULT 0.15,
  peso_afastamentos NUMERIC NOT NULL DEFAULT 0.15,
  limiar_verde NUMERIC NOT NULL DEFAULT 70,
  limiar_amarelo NUMERIC NOT NULL DEFAULT 50,
  amostra_minima INTEGER NOT NULL DEFAULT 5,
  cobertura_alvo NUMERIC NOT NULL DEFAULT 0.6,
  dias_consecutivos_amarelo INTEGER NOT NULL DEFAULT 2,
  variacao_relevante_percentual NUMERIC NOT NULL DEFAULT 0.15,
  versao INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE efetivos_setor_turno(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  efetivo_esperado INTEGER NOT NULL CHECK(efetivo_esperado > 0),
  UNIQUE(unidade_id, setor_id, turno_id)
);

CREATE TABLE indices_setor(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  tipo_periodo TEXT NOT NULL CHECK(tipo_periodo IN ('DIARIO','SEMANAL','MENSAL')),
  data_periodo TEXT NOT NULL CHECK(data_periodo ~ '^\d{4}-\d{2}-\d{2}$'),
  score NUMERIC,
  status TEXT CHECK(status IN ('VERDE','AMARELO','VERMELHO')),
  confiabilidade TEXT NOT NULL CHECK(confiabilidade IN ('INCONCLUSIVO','BAIXA','ALTA')),
  total_respostas INTEGER NOT NULL DEFAULT 0,
  taxa_participacao NUMERIC,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculado_em TIMESTAMPTZ NOT NULL,
  UNIQUE(unidade_id, setor_id, turno_id, tipo_periodo, data_periodo)
);
CREATE INDEX idx_indices_setor_scope ON indices_setor(unidade_id, setor_id, turno_id, tipo_periodo, data_periodo);

CREATE TABLE alertas(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  regra TEXT NOT NULL,
  nivel TEXT NOT NULL CHECK(nivel IN ('AMARELO','VERMELHO')),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANALISE','TRATADO','DESCARTADO')),
  motivo TEXT NOT NULL,
  dados_origem JSONB NOT NULL DEFAULT '{}'::jsonb,
  gerado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX idx_alertas_ativo_unico ON alertas(unidade_id, setor_id, turno_id, regra)
  WHERE status IN ('ABERTO','EM_ANALISE');
CREATE INDEX idx_alertas_scope ON alertas(unidade_id, setor_id, turno_id);

CREATE TABLE analises_periodicas(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  periodicidade TEXT NOT NULL CHECK(periodicidade IN ('SEMANAL','MENSAL')),
  data_periodo TEXT NOT NULL CHECK(data_periodo ~ '^\d{4}-\d{2}-\d{2}$'),
  versao_motor TEXT NOT NULL,
  resumo TEXT NOT NULL,
  evidencias JSONB NOT NULL,
  correlacoes JSONB NOT NULL,
  nivel_atencao TEXT NOT NULL CHECK(nivel_atencao IN ('BAIXA','MODERADA','ALTA')),
  indicadores_acompanhar JSONB NOT NULL,
  gerado_em TIMESTAMPTZ NOT NULL,
  UNIQUE(unidade_id, setor_id, turno_id, periodicidade, data_periodo)
);

CREATE TABLE planos_acao(
  id TEXT PRIMARY KEY,
  analise_id TEXT NOT NULL REFERENCES analises_periodicas(id) ON DELETE CASCADE,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','DESCARTADO')),
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);

CREATE TABLE acoes_plano(
  id TEXT PRIMARY KEY,
  plano_id TEXT NOT NULL REFERENCES planos_acao(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL CHECK(ordem BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','DESCARTADO')),
  UNIQUE(plano_id, ordem)
);

CREATE TABLE log_auditoria(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  usuario_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL,
  hash_anterior TEXT,
  hash_atual TEXT NOT NULL
);
CREATE INDEX idx_log_auditoria_escopo ON log_auditoria(unidade_id, entidade, entidade_id);

CREATE TABLE requisicoes_totem(
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(unidade_id, idempotency_key)
);
