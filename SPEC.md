# AgriHub — Spec-base do MVP

**Status:** rascunho validado parcialmente  
**Versão:** 0.2  
**Fase atual:** definição de produto, sem implementação das funcionalidades

## 1. Visão do produto

O AgriHub será uma aplicação para acompanhar sinais coletivos de bem-estar em
frigoríficos. Na entrada, trabalhadores respondem a três perguntas rápidas em um
tablet compartilhado. As respostas são anônimas e agregadas por setor e turno.

O supervisor cruza esses resultados com indicadores estratégicos fornecidos pelo RH
e recebe um resumo semanal com um plano de ação sugerido. No primeiro MVP, a análise
de IA será simulada, mas deverá consumir a mesma estrutura de dados prevista para a
integração real futura.

## 2. Frentes do MVP

### 2.1 Frente 1 — Portal do Totem

O totem fica na entrada da unidade e possui uma página exclusiva, otimizada para
tablet e uso rápido.

Fluxo:

1. O trabalhador seleciona seu setor.
2. O sistema identifica automaticamente o turno vigente com base no horário e nos
   turnos padronizados e pré-cadastrados.
3. O trabalhador responde às três perguntas fixas do dia.
4. Cada pergunta usa uma escala visual de 1 a 5, com emoji e texto de apoio.
5. O sistema confirma o envio e volta automaticamente à seleção de setor.

Perguntas fixas:

| Indicador | Pergunta-base | Direção da escala |
| --- | --- | --- |
| Energia | Como está seu nível de energia hoje? | 1 = muito baixo; 5 = muito alto |
| Dor/cansaço físico | Como está seu nível de dor ou cansaço físico? | 1 = nenhum; 5 = muito intenso |
| Ansiedade/estresse | Como está seu nível de ansiedade ou estresse? | 1 = nenhum; 5 = muito intenso |

As escalas têm direções diferentes. Energia alta é positiva, enquanto dor/cansaço e
ansiedade/estresse altos indicam atenção. O backend e o dashboard devem preservar
essa semântica; não é permitido calcular uma média única sem normalizar as escalas.

Requisitos do totem:

- ativação inicial por identificador exclusivo configurado no tablet;
- sessão persistente em modo quiosque;
- credencial restrita às rotas do totem;
- nenhuma autenticação ou identificação do trabalhador;
- setores apresentados como botões grandes;
- turno não pode ser escolhido ou alterado pelo trabalhador;
- três respostas obrigatórias antes da confirmação, salvo decisão futura sobre a
  opção de pular;
- retorno automático ao início após o envio ou inatividade;
- estados de perda de rede, credencial revogada e ausência de turno vigente.

Categorias e setores iniciais:

| Categoria | Setores |
| --- | --- |
| Área Quente | Abate primeira fase; Abate segunda fase; Miúdos; Bucharia limpa; Bucharia suja; Gracharia |
| Área Fria | Expedição caixaria; Expedição com osso; Desossa; Embalagem secundária |

Todo setor deve pertencer obrigatoriamente à Área Quente ou à Área Fria.

### 2.2 Frente 2 — Painel do Supervisor/Subgestor

Supervisor e subgestor representam o mesmo perfil no MVP. Esse perfil é responsável
pela análise dos setores sob sua responsabilidade.

Responsabilidades:

- vincular-se a um ou mais setores;
- acompanhar um setor e turno específicos;
- analisar resultados do dia, semana e mês;
- acompanhar os indicadores estratégicos fornecidos pelo RH;
- consultar o resumo semanal e o plano de ação sugerido pela IA simulada.

Visões mínimas do painel:

1. Resumo atual do setor selecionado.
2. Energia média normalizada.
3. Dor/cansaço físico médio.
4. Ansiedade/estresse médio.
5. Volume de respostas anônimas.
6. Evolução diária e semanal por indicador.
7. Comparação entre turnos do setor, quando o supervisor possuir esse escopo.
8. Indicadores de RH: faltas e afastamentos.
9. Resumo semanal de IA e plano de ação sugerido.

Filtros mínimos:

- setor;
- turno;
- período diário, semanal e mensal;
- indicador de bem-estar;
- indicador estratégico de RH.

### 2.3 Frente 3 — Portal do RH

O RH disponibiliza dados estratégicos agregados para complementar a análise do
supervisor.

Indicadores do MVP:

| Indicador | Unidade sugerida | Granularidade mínima |
| --- | --- | --- |
| Faltas | Quantidade ou percentual | Setor + turno + período |
| Afastamentos | Quantidade | Setor + turno + período |

Funções previstas:

- acesso autenticado com perfil RH;
- lançamento manual ou importação dos indicadores;
- validação antes da gravação;
- consulta do histórico enviado;
- correção controlada e auditada;
- disponibilização dos dados agregados ao painel do supervisor.

O MVP não coleta motivo ou categoria do afastamento, evitando conteúdo clínico e
mantendo o indicador estritamente agregado.

## 3. Perfis e autorização

| Perfil | Escopo |
| --- | --- |
| Supervisor/Subgestor | Configura e analisa somente os setores vinculados |
| RH | Inclui e consulta indicadores estratégicos da unidade |
| Totem | Lê setores, identifica o turno e registra contadores agregados |

Regras:

1. Toda credencial pertence a uma única unidade.
2. O supervisor só acessa setores explicitamente vinculados a ele.
3. O RH não acessa respostas individuais, pois elas não existem.
4. O totem não acessa dashboard, configuração ou dados de RH.
5. O turno é calculado no servidor usando a hora local da unidade.

## 4. Privacidade e anonimização

1. Não existe perfil ou login de trabalhador.
2. A resposta não pode receber nome, matrícula, CPF, e-mail, biometria ou outro
   identificador pessoal.
3. O backend persiste apenas contadores por unidade, setor, turno, data, pergunta e
   nota.
4. Não haverá tabela de respostas individuais.
5. Dados de RH entram agregados; não serão importados nomes, matrículas, documentos,
   diagnósticos, atestados, motivos ou descrições clínicas.
6. Resultados abaixo de um número mínimo de respostas ficam ocultos no painel. O
   limiar ainda será definido.
7. Logs técnicos não registram conteúdo que identifique trabalhadores.
8. Toda consulta é limitada por unidade e pelo escopo de setores do usuário.

## 5. Regras de turno automático

- Cada turno possui nome, hora inicial, hora final e dias ativos.
- O servidor determina o turno vigente usando o fuso horário da unidade.
- Turnos que atravessam a meia-noite devem ser suportados.
- Não pode haver sobreposição de turnos ativos no mesmo setor, salvo regra futura
  explicitamente aprovada.
- Se nenhum turno estiver vigente, o totem bloqueia a pesquisa e apresenta uma
  mensagem operacional sem permitir escolha manual.
- Alterações de turno passam a valer somente para novos envios.

## 6. Indicadores derivados

Para permitir comparação coerente, cada resposta deve ser convertida para uma escala
de saúde coletiva em que valores maiores sempre representam uma condição melhor:

```text
energia_normalizada = energia
fisico_normalizado = 6 - nota_dor_cansaco
emocional_normalizado = 6 - nota_ansiedade_estresse

indice_bem_estar = média(
  energia_normalizada,
  fisico_normalizado,
  emocional_normalizado
)
```

O índice composto é uma proposta inicial e não constitui diagnóstico. Pesos,
limiares e nomenclatura ainda precisam de validação. O painel também deve exibir os
três indicadores separadamente para evitar que a média esconda um problema específico.

## 7. Resumo semanal e IA simulada

Uma vez por semana, por setor e turno, o sistema reúne:

- tendência de energia;
- tendência de dor/cansaço;
- tendência de ansiedade/estresse;
- volume de respostas;
- faltas;
- afastamentos;
- comparação com a semana anterior.

No MVP, um motor determinístico simulará a IA por meio de regras e textos pré-definidos.
O resultado deve conter:

1. resumo dos principais sinais;
2. correlações observadas, sem afirmar causalidade;
3. nível geral de atenção;
4. até três ações recomendadas;
5. indicadores que devem ser acompanhados na semana seguinte;
6. aviso de que a análise é apoio à decisão e não diagnóstico.

Exemplo de regra simulada:

```text
SE dor/cansaço aumentar
E faltas ou afastamentos aumentarem
ENTÃO sugerir revisão das pausas e acompanhamento preventivo do setor.
```

O sistema deve usar linguagem como “há associação” ou “os dados coincidem”, nunca
afirmar que um indicador causou outro.

## 8. Modelo conceitual provisório

```text
unidades
usuarios
setores
usuario_setores
turnos
setor_turnos
totens
perguntas
respostas_agregadas
indicadores_rh
resumos_semanais
planos_acao
log_auditoria
```

Chave lógica dos contadores do totem:

```text
unidade + setor + turno + data + pergunta + nota
```

Chave lógica dos indicadores de RH:

```text
unidade + setor + turno + período + tipo
```

## 9. Contratos HTTP previstos

Os payloads serão fechados antes da implementação.

```text
POST /api/v1/auth/supervisor
POST /api/v1/auth/rh
POST /api/v1/auth/totem

GET  /api/v1/totem/contexto
POST /api/v1/totem/respostas

GET  /api/v1/supervisor/resumo
GET  /api/v1/supervisor/historico
GET  /api/v1/supervisor/resumo-semanal
POST /api/v1/totens

GET  /api/v1/rh/indicadores
POST /api/v1/rh/indicadores
POST /api/v1/rh/importacoes
```

## 10. Telas previstas

| Frente | Tela | Objetivo |
| --- | --- | --- |
| Totem | Ativação do dispositivo | Configurar o identificador do tablet |
| Totem | Seleção de setor | Escolher o setor antes da pesquisa |
| Totem | Questionário | Responder as três perguntas em escala de 1 a 5 |
| Totem | Confirmação | Confirmar e reiniciar o fluxo |
| Supervisor | Login | Acessar os setores vinculados |
| Supervisor | Dashboard | Cruzar bem-estar e indicadores estratégicos |
| Supervisor | Histórico | Analisar dia, semana e mês |
| Supervisor | Resumo semanal | Consultar análise simulada e plano de ação |
| Supervisor | Indicadores por setor | Comparar energia, desgaste físico e estresse por setor |
| Supervisor | Análise mensal | Cruzar bem-estar, faltas e afastamentos com apoio da IA |
| RH | Login | Acessar a frente de indicadores |
| RH | Indicadores | Cadastrar faltas e afastamentos |
| RH | Histórico de envios | Consultar e auditar dados fornecidos |

## 11. Requisitos de experiência

- O totem deve usar botões grandes, texto além de emoji e poucos passos.
- As três perguntas devem caber em um fluxo curto, com progresso visível.
- A resposta deve ser confirmada em até três segundos.
- O estado do trabalhador anterior deve ser limpo automaticamente.
- O painel deve deixar claro quando o dado está oculto por amostra insuficiente.
- Indicadores negativos e positivos devem ser visualmente distinguíveis sem depender
  apenas de cor.
- O dashboard deve funcionar em desktop e tablet.
- Devem existir estados de carregamento, vazio, erro, offline, dispositivo revogado
  e ausência de turno vigente.

## 12. Critérios iniciais de aceite

- Uma credencial de totem não acessa rotas de supervisor ou RH.
- O trabalhador não escolhe o turno; ele é definido corretamente pelo horário.
- O envio contém exatamente as três respostas e nenhum identificador pessoal.
- Dois envios simultâneos não perdem incrementos.
- O dashboard apresenta cada indicador separadamente e o índice normalizado.
- O supervisor só acessa setores vinculados.
- Dados de RH aparecem agregados no painel do supervisor.
- Nenhum motivo ou categoria de afastamento é coletado.
- Filtros de setor, turno e período respeitam unidade e escopo.
- O resumo semanal cruza bem-estar e RH e se identifica como análise simulada.
- O tablet retorna ao início após resposta ou inatividade.
- Uma credencial de tablet revogada deixa de registrar respostas imediatamente.

## 13. Fora do escopo desta versão

- diagnóstico individual ou automatizado de saúde;
- identificação de trabalhador;
- prontuário, atestado ou conteúdo clínico;
- indicadores de RH em nível individual;
- integração com relógio de ponto;
- IA generativa real;
- execução automática das ações sugeridas;
- relatórios legais ou médicos.

## 14. Decisões ainda pendentes

1. O supervisor poderá administrar somente seus setores ou toda a unidade?
2. Qual será o tamanho mínimo da amostra para exibir resultados?
3. O trabalhador poderá pular uma pergunta ou desistir da pesquisa?
4. Como impedir respostas repetidas sem identificar o trabalhador?
5. O totem precisa funcionar offline no primeiro piloto?
6. Como os indicadores de RH entrarão: formulário, CSV ou ambos?
7. Faltas serão quantidade absoluta, percentual ou ambos?
8. Quais pesos e limiares formarão o índice composto de bem-estar?
9. O plano de ação simulado será apenas sugerido ou terá acompanhamento de status?
10. Qual banco e ambiente de hospedagem serão usados no piloto?
11. Como supervisor e RH acessarão o sistema: senha, código, e-mail ou SSO?
12. Quais identidade visual, nome definitivo e logotipo serão utilizados?

## 15. Próximas etapas após as decisões

1. Validar escalas e linguagem com RH/SESMT.
2. Definir a amostra mínima para exibição dos resultados.
3. Fechar wireframes das três frentes.
4. Congelar modelo de dados e contratos da API.
5. Implementar autenticação e isolamento por unidade/setor.
6. Implementar Totem, Painel do Supervisor e Portal do RH.
7. Implementar regras da análise semanal simulada.
8. Validar privacidade, concorrência, acessibilidade e operação offline.
