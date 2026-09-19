# AgriHub — Spec adicional de evolução do MVP

**Versão:** 1.0  
**Status:** pronta para implementação  
**Escopo:** evolução dos indicadores, inteligência analítica e migração para PostgreSQL

## 1. Objetivo

Evoluir o MVP para transformar os dados anônimos do totem e os indicadores agregados
do RH em sinais objetivos de atenção por setor e turno. O sistema deverá comparar
períodos, identificar tendências e gerar planos de ação semanais e mensais por meio
de uma IA simulada, sem realizar diagnóstico individual.

Esta implementação também substituirá o SQLite pelo PostgreSQL como banco oficial
da aplicação.

## 2. Escopo funcional

### 2.1 Índice de atenção do setor

O sistema deverá calcular um índice de 0 a 100 por setor, turno e período usando:

- nível de energia normalizado;
- dor ou cansaço físico invertido;
- ansiedade ou estresse invertido;
- faltas agregadas;
- afastamentos agregados;
- quantidade de respostas e confiabilidade da amostra.

Classificação inicial:

| Faixa | Estado | Interpretação |
| --- | --- | --- |
| 70 a 100 | Verde | Condição estável |
| 50 a 69,99 | Amarelo | Requer acompanhamento |
| 0 a 49,99 | Vermelho | Requer ação prioritária |

Os pesos e limites deverão ficar centralizados em configuração para permitir ajustes
sem alterações nas telas. O índice não poderá substituir a exibição separada de cada
indicador.

### 2.2 Comparação temporal

O painel do supervisor deverá apresentar, para o setor e turno selecionados:

- comparação com o período imediatamente anterior;
- evolução diária dos últimos 7 ou 30 dias;
- evolução semanal no mês selecionado;
- variação percentual de energia, desgaste físico, estresse, faltas e afastamentos;
- indicação visual de melhora, estabilidade ou piora;
- aviso quando não houver amostra suficiente para comparação.

Períodos mínimos: diário, semanal e mensal.

### 2.3 Participação e confiabilidade

O dashboard deverá mostrar o total de respostas anônimas e, quando houver efetivo
esperado cadastrado, a taxa estimada de participação.

Regras:

- nenhuma tentativa de identificar o trabalhador;
- resultados abaixo da amostra mínima ficam ocultos ou marcados como inconclusivos;
- o índice deverá informar o nível de confiabilidade da amostra;
- amostra mínima e faixas de confiabilidade serão configuráveis;
- o total de respostas não representa automaticamente o total de pessoas únicas.

### 2.4 Alertas automáticos

O sistema deverá criar alertas por setor e turno quando ocorrer ao menos uma condição:

- índice em vermelho;
- índice em amarelo por dois períodos consecutivos;
- queda relevante de energia;
- aumento relevante de dor/cansaço ou estresse;
- aumento simultâneo de desgaste e faltas/afastamentos;
- redução da amostra abaixo do mínimo definido.

Cada alerta terá nível, motivo, dados que o originaram, data, status e setor/turno.
Estados previstos: `ABERTO`, `EM_ANALISE`, `TRATADO` e `DESCARTADO`.

Alertas semelhantes não deverão ser duplicados enquanto existir um alerta ativo para
a mesma regra, setor e turno.

### 2.5 Análise e plano de ação

A IA simulada deverá cruzar, semanal e mensalmente:

- energia, dor/cansaço e ansiedade/estresse;
- tendência em relação ao período anterior;
- faltas e afastamentos agregados;
- volume e confiabilidade das respostas;
- alertas abertos e histórico recente do setor.

A saída deverá conter:

1. resumo executivo;
2. principais evidências utilizadas;
3. correlações encontradas, sem afirmar causalidade;
4. nível de atenção;
5. até três ações sugeridas;
6. indicadores a acompanhar no próximo período;
7. aviso de que a análise apoia decisões e não constitui diagnóstico.

Exemplos de ações: revisar pausas, avaliar rodízio de postos, reforçar orientação
ergonômica, observar ritmo operacional ou solicitar análise técnica do SESMT.

O plano será produzido inicialmente por regras determinísticas versionadas. A API
deverá permitir substituir esse motor por uma IA real no futuro sem alterar o contrato
consumido pelo frontend.

## 3. Ajustes no totem

O fluxo continuará curto: setor, três respostas, confirmação e retorno automático ao
início.

Regras obrigatórias:

- o totem deve aceitar respostas consecutivas no mesmo tablet;
- não haverá bloqueio por tempo, setor, turno, IP ou dispositivo após um envio;
- a tela deverá ser limpa imediatamente para o próximo trabalhador;
- botões permanecem habilitados para o próximo ciclo após a confirmação;
- gravações simultâneas deverão usar operação atômica para não perder contadores;
- falhas de rede deverão permitir nova tentativa sem duplicar o mesmo envio técnico;
- um identificador aleatório de requisição poderá garantir idempotência da tentativa,
  mas nunca poderá identificar ou rastrear o trabalhador.

O sistema não tentará impedir múltiplas respostas de uma mesma pessoa, pois isso
exigiria identificação e prejudicaria o uso sequencial do tablet. A confiabilidade será
tratada por amostra, contexto operacional e acompanhamento de anomalias agregadas.

## 4. PostgreSQL

### 4.1 Diretriz

PostgreSQL será o único banco suportado após a migração. SQLite permanecerá apenas
como origem temporária para migração e não será usado em produção.

Configuração mínima por ambiente:

```text
DATABASE_URL=postgresql://usuario:senha@host:5432/agrihub
DATABASE_SSL=true|false
```

### 4.2 Estrutura adicional

Além das tabelas existentes, deverão ser criadas:

```text
schema_migrations
configuracoes_indicadores
efetivos_setor_turno
indices_setor
alertas
analises_periodicas
planos_acao
acoes_plano
log_auditoria
requisicoes_totem
```

Requisitos técnicos:

- chaves estrangeiras e restrições de domínio no banco;
- timestamps em UTC e fuso da unidade aplicado na apresentação;
- índices compostos para unidade, setor, turno e período;
- transação atômica para incrementar respostas agregadas;
- pool de conexões;
- migrations versionadas e reversíveis quando possível;
- seed separado por ambiente;
- backup antes da importação do SQLite;
- nenhum dado pessoal nos contadores ou logs do totem.

### 4.3 Migração de dados

Sequência prevista:

1. criar schema e usuário do PostgreSQL;
2. executar migrations;
3. importar unidade, usuários, setores, turnos e totens;
4. importar respostas agregadas e indicadores do RH;
5. validar totais e relacionamentos;
6. executar o seed demonstrativo somente se a base estiver vazia;
7. trocar a aplicação para `DATABASE_URL`;
8. validar APIs e manter backup do SQLite para contingência.

A migração será aceita somente se as contagens por tabela e os totais agregados por
setor coincidirem com a origem.

## 5. Telas afetadas

### Dashboard do supervisor

- cartão do índice geral e sua classificação;
- tendência em relação ao período anterior;
- qualidade da amostra;
- alertas ativos;
- gráfico comparativo dos indicadores;
- acesso ao resumo e plano de ação.

### Indicadores por setor

- tabela comparativa por setor e turno;
- ordenação por nível de atenção;
- filtros diário, semanal e mensal;
- detalhamento das evidências que formaram o índice.

### Análise mensal

- cruzamento entre bem-estar, faltas e afastamentos;
- comparação com o mês anterior;
- análise mensal da IA simulada;
- plano de ação e indicadores para acompanhamento.

### Totem

- confirmação curta após o envio;
- limpeza automática das escolhas;
- retorno imediato à seleção de setor;
- nenhum bloqueio entre trabalhadores.

## 6. Contratos de API adicionais

```text
GET   /api/v1/supervisor/indices
GET   /api/v1/supervisor/comparativo
GET   /api/v1/supervisor/participacao
GET   /api/v1/supervisor/alertas
PATCH /api/v1/supervisor/alertas/:id
GET   /api/v1/supervisor/analises?periodicidade=semanal|mensal
GET   /api/v1/supervisor/planos-acao
PATCH /api/v1/supervisor/planos-acao/:id
```

Todas as rotas deverão restringir dados por unidade e setores associados ao usuário.
O portal do RH continuará separado e não aparecerá na navegação do supervisor.

## 7. Critérios de aceite

- a aplicação inicia e opera exclusivamente com PostgreSQL;
- os dados demonstrativos são criados de forma idempotente em uma base vazia;
- todos os dados existentes são migrados sem divergência de totais;
- o totem aceita dois ou mais ciclos completos consecutivos sem espera ou bloqueio;
- envios concorrentes não perdem incrementos;
- uma repetição técnica da mesma requisição não duplica contadores;
- o supervisor visualiza índice, classificação e indicadores que o compõem;
- comparações semanais e mensais usam períodos equivalentes;
- resultados com amostra insuficiente não são apresentados como conclusivos;
- alertas são gerados pelas regras definidas e não são duplicados enquanto ativos;
- a IA simulada cruza dados do totem e do RH semanal e mensalmente;
- cada sugestão informa as evidências utilizadas;
- nenhum dado ou identificador individual é armazenado;
- testes automatizados cobrem cálculos, permissões, concorrência e migrations.

## 8. Fora do escopo

- identificação ou autenticação de trabalhadores;
- bloqueio de respostas repetidas por pessoa;
- diagnóstico médico ou psicológico;
- IA generativa conectada a serviço externo;
- notificações por WhatsApp, e-mail ou SMS;
- integração automática com folha ou relógio de ponto;
- execução automática dos planos sugeridos.

## 9. Ordem de implementação

1. Preparar PostgreSQL, migrations, seed e importação do SQLite.
2. Adaptar models e repositórios do backend para PostgreSQL.
3. Garantir gravação atômica e idempotência técnica no totem.
4. Implementar cálculo do índice e qualidade da amostra.
5. Implementar comparações temporais e alertas.
6. Implementar motor determinístico de análise e planos de ação.
7. Atualizar telas do supervisor e análise mensal.
8. Executar testes de integração, concorrência, autorização e privacidade.

## 10. Decisões pendentes antes da implementação

1. Onde o PostgreSQL será hospedado no piloto.
2. Qual será a amostra mínima para exibição.
3. Qual é o efetivo esperado de cada setor e turno.
4. Quais pesos finais compõem o índice.
5. Quais variações percentuais geram alertas.
6. Se o supervisor poderá atualizar o status dos planos de ação.
