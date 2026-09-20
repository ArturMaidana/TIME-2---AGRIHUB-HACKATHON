ALTER TABLE configuracoes_indicadores
  ADD COLUMN usar_ia_generativa BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE analises_periodicas
  ADD COLUMN resumo_ia TEXT,
  ADD COLUMN hash_entrada TEXT,
  ADD COLUMN gerado_por_ia BOOLEAN NOT NULL DEFAULT false;
