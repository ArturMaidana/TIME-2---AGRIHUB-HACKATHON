# Arquitetura e Escalabilidade - AgriPulso

Este documento detalha o panorama tecnológico atual do projeto e propõe um plano estratégico de arquitetura para escalar a aplicação para ambientes de produção com alta disponibilidade utilizando serviços em nuvem, com foco na AWS (Amazon Web Services).

---

## 1. Tecnologias e Linguagens Atuais

O projeto foi construído no modelo Monorepo (Frontend e Backend juntos no mesmo repositório), priorizando simplicidade e leveza no desenvolvimento atual (MVP).

### Frontend (Aplicação Web)
* **Linguagem**: JavaScript (ES6+ / JSX)
* **Biblioteca Principal**: React
* **Build Tooling**: Vite (para compilação rápida e Hot Module Replacement)
* **Estilização**: CSS Vanilla / Módulos com design system customizado
* **Ícones**: Lucide React

### Backend (Servidor de API)
* **Linguagem**: JavaScript (via Node.js v22+)
* **Arquitetura de API**: API RESTful, utilizando os módulos e bibliotecas core do Node.js
* **Comunicação com BD**: Pacote `pg` nativo (node-postgres) para executar queries

### Banco de Dados
* **SGBD**: PostgreSQL, atualmente em ambiente local configurado via Docker Compose.
* **Fluxo de Migrations**: Scripts puros em Node.js (`db:migrate`, `db:rebuild`).

---

## 2. Proposta de Escalabilidade (Arquitetura na Nuvem com AWS)

Para evoluir a aplicação de um MVP para uma solução robusta, capaz de suportar centenas ou milhares de usuários acessando totens, relatórios de RH e dashboards simultaneamente, recomendamos a migração para a nuvem utilizando serviços gerenciados da **AWS**.

Abaixo está o modelo de arquitetura proposto para escalabilidade, alta disponibilidade e segurança.

### 2.1. Frontend: CDN e Armazenamento Estático
* **Serviço Proposto:** **Amazon S3 + Amazon CloudFront**
* **Como funciona:** O build de produção do React/Vite (arquivos estáticos `index.html`, `js`, `css`) será armazenado em um bucket do Amazon S3. O Amazon CloudFront atuará como a Content Delivery Network (CDN), distribuindo esses recursos com baixa latência e alta velocidade em diversas regiões, além de adicionar proteção contra ataques DDoS com AWS Shield e criptografia SSL via AWS Certificate Manager (ACM).

### 2.2. Backend: Orquestração de Containers e Auto Scaling
* **Serviço Proposto:** **Amazon ECS (Elastic Container Service) com AWS Fargate**
* **Como funciona:** 
  1. O backend em Node.js será encapsulado em um container Docker (Dockerfile).
  2. A imagem do container ficará armazenada no **Amazon ECR (Elastic Container Registry)**.
  3. O ECS com Fargate gerenciará a execução desses containers no formato Serverless, eliminando a necessidade de administrar servidores EC2 manualmente.
  4. Através de regras de Auto Scaling, o número de containers (instâncias do Node.js) pode crescer automaticamente dependendo da utilização da CPU, RAM ou tráfego de rede (aumento de acessos no horário de pico nas granjas, por exemplo).

### 2.3. Banco de Dados: Relacional Gerenciado
* **Serviço Proposto:** **Amazon RDS (Relational Database Service) para PostgreSQL**
* **Como funciona:** Para o PostgreSQL, usaremos o Amazon RDS, retirando a responsabilidade de gerenciar instâncias de banco de dados por conta própria.
  * **Multi-AZ:** O RDS será configurado com uma zona de disponibilidade múltipla, o que cria réplicas síncronas do banco em outras localizações, garantindo alta disponibilidade caso a base de dados primária caia.
  * **Backups Automáticos e Snapshots:** Restauração facilitada (Point-in-time recovery) no caso de perda acidental de dados.

### 2.4. Cache e Gerenciamento de Sessão (Desacoplamento)
* **Serviço Proposto:** **Amazon ElastiCache (Redis)**
* **Como funciona:** À medida que o uso cresce, as consultas aos Dashboards (análises mensais, métricas de setores) ficarão mais pesadas. O ElastiCache (Redis) atuará como camada de cache na frente do banco de dados, armazenando consultas caras ou dados de sessão dos usuários, melhorando consideravelmente o tempo de resposta da API e diminuindo a carga sobre o Amazon RDS.

### 2.5. Balanceamento de Carga e Rede (VPC)
* **Serviço Proposto:** **ALB (Application Load Balancer) + Amazon VPC**
* **Como funciona:** 
  * A aplicação residirá dentro de uma Amazon VPC (Virtual Private Cloud).
  * O RDS e o ElastiCache ficarão em **Sub-redes Privadas**, ou seja, inacessíveis diretamente via internet, garantindo a máxima segurança dos dados.
  * O ALB receberá todo o tráfego da internet (HTTPS) e será o responsável por distribuir as requisições de forma balanceada para os containers rodando no AWS Fargate (Backend).

### 2.6. Monitoramento, Logs e Alarmes
* **Serviço Proposto:** **Amazon CloudWatch**
* **Como funciona:** Todos os logs da API (erros, warnings) e do Banco de Dados serão centralizados no CloudWatch. Configura-se também alarmes que notificarão as equipes responsáveis caso a CPU ultrapasse um limite perigoso, o espaço em disco esteja no fim, ou a API passe a demorar muito para responder.

---

## 3. Resumo da Evolução da Arquitetura

| Camada / Componente | Cenário Atual (MVP) | Escalável (Produção AWS) | Benefício de Escala |
|---------------------|---------------------|--------------------------|---------------------|
| **Frontend Web** | Vite (Servidor de Dev local) | Amazon S3 + CloudFront | Distribuição global, sem carga no servidor, cache na borda. |
| **Backend API** | Node.js nativo executado manualmente | Amazon ECS + AWS Fargate | Balanceamento de carga automático, auto-scaling horizontal, zero downtime deploys. |
| **Banco de Dados** | PostgreSQL via Docker local | Amazon RDS PostgreSQL | Backups diários, tolerância a falhas (Multi-AZ), read replicas e monitoramento otimizado. |
| **Rede/Segurança** | Aberta para rede local | ALB + Amazon VPC Privada | Dados blindados sem acesso externo, criptografia em trânsito com ACM. |
| **Arquivos/Fotos** | Sistema de Arquivos (Local) | Amazon S3 | Armazenamento de arquivos ilimitado, seguro e desvinculado dos servidores de aplicação. |
| **Performance** | Consultas diretas ao BD | Amazon ElastiCache (Redis) | Redução substancial da carga do Banco de Dados e latência mínima de resposta. |
