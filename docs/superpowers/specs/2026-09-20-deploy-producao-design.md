# AgriHub — Deploy em Produção

**Versão:** 1.0
**Status:** aprovado para virar plano de implementação
**Escopo:** colocar o app (frontend + backend + banco) no ar, acessível por URL
pública, pronto para avaliação do hackathon.

## 1. Por que essa arquitetura

O app já é, por construção, **um único processo** que serve tudo: `server/app.js`
despacha `/api/*` pro roteador e qualquer outra rota pro HTML/JS/CSS compilado em
`dist/` (`server/views/static-view.js`). Não existe frontend separado pra hospedar —
o mesmo processo Node que atende a API também entrega a SPA. Isso simplifica o
deploy: **um serviço de aplicação + um Postgres gerenciado**, nada de coordenar dois
deploys.

Duas restrições reais do código de hoje que moldam a escolha de provedor:

- `server/index.js` chama `createServer(app).listen(...)` — é um processo HTTP
  **de vida longa**, não uma função serverless. Precisa de um host que rode Node
  continuamente (Render, Railway, Fly.io — não Vercel/Netlify no modo padrão deles).
- `server/config/session-store.js` guarda sessões de login num `Map` **em
  memória**. Cada reinício do processo desloga todo mundo, e rodar mais de uma
  instância simultânea quebraria o login (sessão criada numa instância não existe
  na outra). Decisão desta rodada: **manter assim** — o login é um código simples
  (`SUPERVISOR`, `RH2026`, etc.), relogar é trivial, e só vamos rodar **uma única
  instância**. Documentado aqui pra não ser esquecido se o projeto crescer.

## 2. Provedores escolhidos

- **Banco: [Neon](https://neon.tech)** — Postgres gerenciado, tier gratuito sem
  expiração por tempo (diferente do Postgres gratuito do Render, que expira em 90
  dias), sempre ativo, SSL obrigatório (já suportado — `DATABASE_SSL=true` liga
  `ssl: { rejectUnauthorized: false }` em `server/config/database.js`).
- **Aplicação: [Render](https://render.com)** — Web Service Node, deploy automático
  a cada push na `main` (mesmo fluxo de branch único que o time já usa), HTTPS e
  subdomínio `*.onrender.com` grátis. Limitação aceita: o tier gratuito "dorme"
  após ~15 min sem tráfego e leva ~30s pra acordar no primeiro acesso seguinte —
  tranquilo para avaliação de hackathon, não para uso contínuo real.

## 3. O que muda no repositório

Nada na lógica da aplicação — só configuração de deploy:

- **`.node-version`** (novo, raiz do projeto): conteúdo `22`. É a forma mais
  confiável de o Render fixar a versão do Node (o `engines.node` do
  `package.json` já pede `>=22`, mas `.node-version` remove qualquer ambiguidade).
- **`render.yaml`** (novo, raiz do projeto) — Blueprint do Render, documenta e
  fixa a configuração do Web Service como código, pra não depender de cliques
  manuais na dashboard toda vez que precisar recriar o serviço:

  ```yaml
  services:
    - type: web
      name: agrihub
      runtime: node
      plan: free
      buildCommand: npm install && npm run build
      startCommand: npm start
      healthCheckPath: /api/health
      envVars:
        - key: APP_TIMEZONE
          value: America/Cuiaba
        - key: DATABASE_SSL
          value: "true"
        - key: DATABASE_URL
          sync: false
        - key: GROQ_API_KEY
          sync: false
  ```

  `sync: false` marca as duas variáveis como **secretas**: o Render pede pra
  preenchê-las manualmente na dashboard na primeira vez (nunca ficam no arquivo,
  nunca vão pro git). `PORT` não entra na lista — o Render injeta a própria porta
  automaticamente, e `appConfig.js` já lê `process.env.PORT` com fallback.

- **Nenhuma mudança em `server/`, `web/` ou `docker-compose.yml`** —
  `docker-compose.yml` continua servindo só pro Postgres local de desenvolvimento;
  produção usa o Postgres do Neon, sem Docker nenhum.

## 4. Passo a passo do provisionamento

Contas e cliques na dashboard **precisam ser feitos por você** — não tenho como
criar contas ou preencher segredos em serviços de terceiros em seu nome. Eu preparo
todo o código/config do passo 3 e te acompanho no resto.

1. **Neon**: criar conta grátis → novo projeto → copiar a *connection string*
   (formato `postgresql://usuario:senha@ep-xxxx.regiao.aws.neon.tech/nomedobanco?sslmode=require`).
2. **Render**: criar conta grátis, conectar a conta do GitHub, autorizar acesso ao
   repositório `ArturMaidana/TIME-2---AGRIHUB-HACKATHON`.
3. **New → Blueprint** no Render, apontando pro `render.yaml` do repositório — cria
   o Web Service já com build/start/health check configurados.
4. Preencher os dois segredos pedidos pelo Render (`DATABASE_URL` com a connection
   string do Neon, `GROQ_API_KEY` com a mesma chave já usada localmente).
5. Deploy inicial roda automaticamente. `server/index.js` já aplica as migrations e
   roda o seed cadastral mínimo sozinho, no boot — o serviço sobe com schema
   pronto.
6. **Seed dos dados mockados (passo manual, uma vez só)**: rodar
   `DATABASE_URL="<connection string do Neon>" DATABASE_SSL=true npm run db:seed-demo`
   a partir da sua máquina, apontando pro banco de produção. É a mesma decisão já
   tomada antes (18 dias de histórico coerente, dois setores em atenção moderada)
   — só que agora aplicada no banco de produção, não no local. **Importante:** isso
   só roda uma vez, manualmente — não faz parte do boot automático do app (senão
   todo redeploy apagaria dados de uso real que viessem a existir depois).
7. Testar a URL pública (`https://agrihub.onrender.com` ou o nome escolhido):
   login como Supervisor/RH/Totem/Funcionário, conferir gráficos, análise com IA,
   Portal do RH.

## 5. Variáveis de ambiente em produção

| Variável | Valor | Onde |
| --- | --- | --- |
| `DATABASE_URL` | connection string do Neon | Secreta, só na dashboard do Render |
| `DATABASE_SSL` | `true` | `render.yaml` (não é segredo) |
| `GROQ_API_KEY` | mesma chave já usada localmente | Secreta, só na dashboard do Render |
| `APP_TIMEZONE` | `America/Cuiaba` | `render.yaml` (não é segredo) |
| `PORT` | injetada automaticamente pelo Render | não configurar manualmente |

A flag `usar_ia_generativa` já nasce `true` por padrão no schema
(`configuracoes_indicadores`) — IA ligada em produção sem passo extra, conforme
decidido. Pra desligar depois, mesmo comando de sempre
(`npm run ia:toggle -- off`), só que apontando `DATABASE_URL` pro Neon.

## 6. O que fica de fora desta rodada (documentado, não esquecido)

- **Sessões em memória**: aceito por decisão explícita (seção 1). Se algum dia for
  preciso rodar mais de uma instância ou sessões persistentes entre deploys, isso
  vira uma spec própria (ex.: tabela `sessions` no Postgres).
- **Cold start do tier gratuito do Render**: sem ação — é uma característica
  conhecida do plano gratuito, aceitável pro período de avaliação.
- **Domínio próprio**: fora de escopo — usamos o subdomínio grátis do Render
  (`*.onrender.com`), a menos que você já tenha um domínio e queira apontar depois
  (mudança de configuração simples, não estrutural).
- **CI de testes antes do deploy**: o Render só builda e sobe; não roda
  `npm test` no pipeline. Rodar os testes continua manual (`npm test`) antes de
  cada push, como já é o hábito desta sessão.

## 7. Teste de verificação pós-deploy

Depois do primeiro deploy bem-sucedido e do seed manual:

- `GET /api/health` responde `200 {"status":"ok"}` (é o próprio health check do
  Render, mas vale conferir direto).
- Login funciona pros 4 perfis (Supervisor, RH, Totem, Funcionário).
- Dashboard mostra gráficos com dados reais (não "amostra insuficiente").
- Envio de reclamação anônima pelo totem/funcionário aparece nas notificações do
  supervisor.
- Análise com IA aparece com o selo "✨ Resumo gerado por IA (Groq)" em pelo menos
  um setor.
