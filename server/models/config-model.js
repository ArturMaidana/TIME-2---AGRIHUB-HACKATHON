import { queryOne } from '../config/database.js';

export const ConfigModel = {
  async getForUnit(unidadeId) {
    const row = await queryOne('SELECT * FROM configuracoes_indicadores WHERE unidade_id = $1', [unidadeId]);
    return row && {
      pesoEnergia: Number(row.peso_energia),
      pesoFisico: Number(row.peso_fisico),
      pesoEmocional: Number(row.peso_emocional),
      pesoFaltas: Number(row.peso_faltas),
      pesoAfastamentos: Number(row.peso_afastamentos),
      limiarVerde: Number(row.limiar_verde),
      limiarAmarelo: Number(row.limiar_amarelo),
      amostraMinima: row.amostra_minima,
      coberturaAlvo: Number(row.cobertura_alvo),
      diasConsecutivosAmarelo: row.dias_consecutivos_amarelo,
      variacaoRelevantePercentual: Number(row.variacao_relevante_percentual),
    };
  },
};
