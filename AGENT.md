# AgriHub — Sistema de Prevenção ao Desgaste Físico e Emocional
## Especificação técnica para construção do MVP (uso por IA de desenvolvimento)

> Contexto: hackathon SESI Experience 2026, desafio AgriHub. Sistema para frigoríficos que detecta precocemente desgaste físico/emocional na linha de produção, **sempre agregado por setor/turno, nunca por pessoa**. Este documento é a especificação para iniciar a construção do código (schema, regras de negócio, endpoints, papéis de acesso).

---

## 1. Objetivo do sistema

Dar à gestão do frigorífico um sinal precoce de desgaste coletivo em cada setor/turno, disparar uma resposta humana estruturada da liderança, e provar ao longo do tempo que isso reduz absenteísmo, afastamentos, rotatividade, remanejamentos emergenciais e horas extras de cobertura — sem nunca identificar um trabalhador individual pelo dado de bem-estar.

**Regra inegociável de arquitetura:** nenhuma tabela do sistema pode ter uma coluna que ligue uma resposta de bem-estar a uma pessoa. A granularidade mínima gravada é `unidade + setor + turno + data`.

---

## 2. Escopo do MVP

**Constrói nesta rodada:**
1. Totem de check-in (2 perguntas/dia, escala 1–5 em emoji)
2. Cálculo do Índice de Desgaste de Turno (IDT)
3. Motor de regras de alerta com escalonamento automático
4. Painel do Gestor (dashboard agregado)
5. Protocolo do Assistente de Liderança (checklist + encaminhamento)
6. Cadastro multi-unidade (frigorífico → setores → turnos → totens → sub-gestores)
7. Trilha de auditoria imutável
8. Importação de indicadores de RH/produção para comparação com o IDT

**Não constrói nesta rodada (fica registrado como conceito/Fase 2):**
- Rodízio Biodinâmico (Frente 3) — mapeamento de postos e sugestão de rotação
- Painel de Pausas em tempo real (NR-36)
- Qualquer diagnóstico automatizado de saúde mental
- Qualquer integração com relógio de ponto eletrônico

---

## 3. Hierarquia de acesso e multi-tenant

Cada frigorífico é uma **unidade** isolada (tenant). A hierarquia de login é:

```
Login GESTOR (1 por unidade/frigorífico)
 ├─ cadastra e remove SUB-GESTORES (login próprio, escopados a 1..N setores)
 ├─ cadastra SETORES e TURNOS da unidade
 ├─ cadastra TOTENS (telas físicas) da unidade
 └─ vê o Painel do Gestor agregado de TODA a unidade

Login TOTEM (1 credencial fixa por tablet, cadastrada pelo GESTOR)
 ├─ não identifica pessoa nenhuma — é o dispositivo, não o trabalhador
 ├─ fica logado permanentemente no tablet, em modo quiosque
 └─ só tem acesso à tela de check-in (setor → pergunta → emoji)

Login SUB-GESTOR (criado pelo GESTOR, dentro da mesma unidade)
 ├─ vê o Painel do Gestor só dos setores sob sua responsabilidade
 └─ acessa o Assistente de Liderança (checklist + encaminhamento) desses setores
```

Não existe um perfil "trabalhador" com login — o trabalhador só interage com o dispositivo Totem, nunca autentica no sistema.

---

## 4. Modelo de dados (schema sugerido)

```
unidades
  id (PK), nome, cnpj, criado_em

usuarios
  id (PK), unidade_id (FK), nome, email, senha_hash,
  papel ENUM('GESTOR','SUB_GESTOR'), criado_em

setores
  id (PK), unidade_id (FK), nome

turnos
  id (PK), unidade_id (FK), nome, hora_inicio, hora_fim

sub_gestor_setores   -- N:N
  usuario_id (FK), setor_id (FK)

totens
  id (PK), unidade_id (FK), credencial_token, apelido (ex: "Catraca Entrada"),
  ativo BOOLEAN, criado_em

checkins_agregados          -- NUNCA tem coluna de pessoa/funcionário
  id (PK), unidade_id (FK), setor_id (FK), turno_id (FK), data DATE,
  momento ENUM('ENTRADA','SAIDA'),
  contagem_nota_1 INT, contagem_nota_2 INT, contagem_nota_3 INT,
  contagem_nota_4 INT, contagem_nota_5 INT, total_respostas INT

indices_desgaste (IDT)      -- calculado 1x/dia por job
  id (PK), unidade_id (FK), setor_id (FK), turno_id (FK), data DATE,
  media_entrada FLOAT, media_saida FLOAT, delta FLOAT,
  pct_respostas_criticas FLOAT, taxa_participacao FLOAT,
  idt_score FLOAT,           -- 0 a 100
  status ENUM('VERDE','AMARELO','VERMELHO')

regras_alerta                -- configurável por unidade
  id (PK), unidade_id (FK), limiar_amarelo FLOAT DEFAULT 70,
  limiar_vermelho FLOAT DEFAULT 50, dias_consecutivos INT DEFAULT 2,
  prazo_tratativa_horas INT DEFAULT 48

alertas
  id (PK), unidade_id (FK), setor_id (FK), turno_id (FK),
  nivel ENUM('AMARELO','VERMELHO'), status ENUM('ABERTO','EM_TRATATIVA','TRATADO','ESCALADO'),
  gerado_em, escalado_em NULLABLE, tratado_por_usuario_id (FK) NULLABLE, tratado_em NULLABLE

checklists_observacao
  id (PK), alerta_id (FK), usuario_id (FK, sub-gestor), respostas JSON, criado_em

encaminhamentos              -- SEM nome de trabalhador, SEM conteúdo clínico
  id (PK), alerta_id (FK) NULLABLE, unidade_id (FK), setor_id (FK), turno_id (FK),
  data, motivo_generico ENUM('SOBRECARGA_FISICA','SOBRECARGA_EMOCIONAL','CONFLITO_INTERPESSOAL','OUTRO'),
  criado_por_usuario_id (FK)

log_auditoria                -- append-only, nunca UPDATE/DELETE
  id (PK), unidade_id (FK), entidade, entidade_id, acao, usuario_id (FK) NULLABLE,
  timestamp, hash_anterior, hash_atual

indicadores_rh_importados     -- vindo do RH/produção, fora deste sistema
  id (PK), unidade_id (FK), setor_id (FK) NULLABLE, turno_id (FK) NULLABLE,
  periodo_referencia DATE,
  tipo ENUM('ABSENTEISMO','AFASTAMENTO','ROTATIVIDADE','REMANEJAMENTO_EMERGENCIAL','HORA_EXTRA_COBERTURA'),
  valor FLOAT, origem ENUM('IMPORTACAO_CSV','MANUAL')

pesquisas_percepcao            -- trimestral, complementar ao IDT diário
  id (PK), unidade_id (FK), setor_id (FK), periodo,
  pergunta, distribuicao_respostas JSON
```

---

## 5. Fórmula do Índice de Desgaste de Turno (IDT)

Calculado 1x por dia, por `setor + turno`, a partir dos contadores agregados do dia.

```
media_entrada       = média ponderada das notas do check-in de ENTRADA
media_saida         = média ponderada das notas do check-in de SAIDA
delta_normalizado   = clamp( (media_entrada - media_saida) / 4 , 0, 1 )
pct_criticas        = (contagem_nota_1 + contagem_nota_2) / total_respostas
taxa_participacao   = total_respostas / efetivo_esperado_do_turno

IDT = 40 * (media_do_dia / 5)
    + 25 * (1 - delta_normalizado)
    + 20 * (1 - pct_criticas)
    + 15 * taxa_participacao

status:
  IDT >= 70            → VERDE
  50 <= IDT < 70        → AMARELO
  IDT < 50              → VERMELHO
```

`efetivo_esperado_do_turno` vem do cadastro de setor/turno (headcount configurado pelo gestor).

---

## 6. Motor de regras de alerta (pseudo-fluxo)

```
diariamente, para cada setor/turno:
  calcular IDT do dia
  se IDT < limiar_amarelo por >= dias_consecutivos dias seguidos:
      criar alerta (nivel=AMARELO, status=ABERTO) para o sub-gestor do setor
  se IDT < limiar_vermelho:
      criar alerta (nivel=VERMELHO, status=ESCALADO) para sub-gestor E gestor da unidade

job de verificação de prazo (a cada hora):
  para cada alerta com status ABERTO/EM_TRATATIVA:
      se agora - gerado_em > prazo_tratativa_horas:
          status = ESCALADO
          notificar gestor da unidade
          registrar em log_auditoria
```

---

## 7. Fluxo funcional completo (ponta a ponta)

1. **Check-in no totem** — trabalhador toca no setor, responde 1 pergunta (escala de emoji 1–5) na entrada e outra idêntica na saída. Sem login pessoal, sem texto livre, botão "pular" sempre visível. Grava incremento em `checkins_agregados` (offline-first, sincroniza quando a rede volta).
2. **Sem identificação** — a escrita nunca carrega id de pessoa; é update atômico de contador por `unidade+setor+turno+data+momento+nota`.
3. **Cálculo diário do IDT** — job roda 1x/dia (ou a cada fechamento de turno), grava em `indices_desgaste`, com o semáforo verde/amarelo/vermelho.
4. **Motor de alerta** — compara IDT ao histórico e às `regras_alerta`; cria registro em `alertas` quando o limiar é cruzado; escalona automaticamente por prazo (ver seção 6).
5. **Observação humana** — sub-gestor recebe o alerta, vai a campo, conversa com a equipe, preenche `checklists_observacao`. O sistema não sugere nem aponta pessoa alguma nessa etapa.
6. **Encaminhamento (se necessário)** — sub-gestor aciona botão "Encaminhar"; sistema cria `encaminhamentos` com motivo genérico, dispara notificação/e-mail para o SESMT/ambulatório já existente na empresa. Nome e dado clínico ficam **fora** deste sistema.
7. **Auditoria** — toda criação/mudança de status de alerta e encaminhamento grava em `log_auditoria` (append-only, hash encadeado), permitindo provar quem tratou, quando, e que nenhum dado individual foi manipulado.
8. **Painel do Gestor** — mostra IDT atual e histórico por setor/turno, alertas abertos/tratados/escalados, tempo médio de resposta, taxa de participação no totem.
9. **Comparação com indicadores de RH** — mensal/trimestralmente, `indicadores_rh_importados` (absenteísmo, afastamento, rotatividade, remanejamento emergencial, hora extra de cobertura) é importado via CSV e exibido lado a lado com o histórico de IDT no Painel do Gestor, para comprovar (contra a linha de base da Fase 0) que o ciclo pressão→desgaste→afastamento está reduzindo.

---

## 8. Telas mínimas do MVP

| Tela | Perfil | Conteúdo |
| --- | --- | --- |
| Check-in | Totem (device) | Seleção de setor + 1 pergunta com 5 emojis + botão pular |
| Cadastro da unidade | Gestor | Setores, turnos, totens, sub-gestores, headcount por turno |
| Painel do Gestor | Gestor | IDT por setor/turno (todos), alertas, comparativo com indicadores de RH |
| Painel do Sub-gestor | Sub-gestor | IDT só dos seus setores, alertas, checklist, botão de encaminhar |
| Importação de indicadores | Gestor | Upload de CSV de absenteísmo/afastamento/rotatividade/remanejamento/hora extra |

---

## 9. Requisitos não funcionais

- **Privacidade por design**: agregação acontece na escrita, não depois — nunca existe uma linha de banco identificável por pessoa.
- **Offline-first no totem**: grava local e sincroniza quando a rede volta.
- **Multi-tenant**: isolamento total de dado entre unidades (`unidade_id` em toda query).
- **Auditável**: `log_auditoria` append-only, nunca UPDATE/DELETE.
- **Kiosk mode** no tablet do totem — sem acesso a outras funções do dispositivo.
- **Hardware**: tela grande, operável com luva, resistente à umidade/lavagem (mínimo IP54).

---

## 10. Critérios de aceite do MVP

- [ ] Check-in funciona sem login individual e sem travar (resposta em ≤ 3s)
- [ ] Nenhuma query do sistema consegue retornar resposta vinculada a uma pessoa
- [ ] IDT é recalculado automaticamente todo dia por setor/turno
- [ ] Alerta amarelo dispara ao sub-gestor; escalona ao gestor se não tratado no prazo
- [ ] Checklist e encaminhamento funcionam sem exigir nome de trabalhador no sistema de bem-estar
- [ ] Log de auditoria registra toda criação/mudança de alerta e encaminhamento
- [ ] Painel do Gestor mostra IDT + indicadores de RH importados lado a lado
