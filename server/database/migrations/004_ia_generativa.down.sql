ALTER TABLE analises_periodicas
  DROP COLUMN resumo_ia,
  DROP COLUMN hash_entrada,
  DROP COLUMN gerado_por_ia;

ALTER TABLE configuracoes_indicadores
  DROP COLUMN usar_ia_generativa;
