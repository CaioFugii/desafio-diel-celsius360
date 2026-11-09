# Celsius 360 (versão reduzida): desafio técnico Diel Energia

Sistema que recebe telemetria crua de sensores IoT de temperatura como se chegasse em tempo real, armazena, enriquece com as regras de negócio (status, conforto térmico no horário de funcionamento) e mostra a situação da rede numa aplicação web.

> **Status:** fundação do monorepo (infra, banco, API, web e testes rodando com um comando). Ingestão, enriquecimento, autenticação e telas entram nas próximas etapas.

## Como rodar do zero

Pré-requisito: Docker com Compose v2.

```bash
docker compose up --build
```

| Serviço | URL |
| --- | --- |
| Aplicação web | http://localhost:8080 |
| API | http://localhost:8080/api (ou http://localhost:3000/api) |
| Documentação OpenAPI | http://localhost:8080/api/docs |
| PostgreSQL/TimescaleDB | `localhost:5434` |

As migrações rodam automaticamente na subida do backend. Para zerar tudo, incluindo os dados: `docker compose down -v`.

As portas podem ser trocadas via `.env` (veja `.env.example`). Os defaults do `docker-compose.yml` servem só para uso local; nenhuma credencial real é versionada.

### Desenvolvimento local (fora do Docker)

```bash
pnpm install
docker compose up -d db
export DATABASE_URL=postgres://celsius:celsius_local@localhost:5434/celsius360
export JWT_SECRET=local-dev-only-secret-change-me
pnpm --filter backend migrate:dev
pnpm dev:backend    # http://localhost:3000
pnpm dev:frontend   # http://localhost:5173 (proxy /api -> :3000)
pnpm test           # Jest em backend e frontend
```

## Estrutura

```
.
├── backend/          NestJS: API REST, SSE, ingestão e enriquecimento
│   ├── migrations/   SQL versionado (aplicado com advisory lock, idempotente)
│   ├── src/
│   └── test/         testes e2e (Jest + supertest)
├── frontend/         React + Vite, servido por nginx no container
├── data/             telemetrias.jsonl (e cadastro.json)
└── docker-compose.yml
```

## Decisões

### Banco de dados: PostgreSQL 16 + TimescaleDB

Escolhi **um único motor, PostgreSQL com a extensão TimescaleDB**, com os três tipos de dado separados em schemas e tabelas com padrões de acesso próprios:

| Dado | Natureza | Onde fica |
| --- | --- | --- |
| Cadastro (clientes, lojas, ambientes, dispositivos, usuários) | relacional, pequeno, muda pouco, exige integridade | tabelas Postgres comuns, com FKs e constraints |
| Dado cru (pacotes como chegaram do broker) | append-only, alto volume, lido só para reprocessar | hypertable particionada por tempo, comprimida, com retenção |
| Séries tratadas e agregadas | leitura intensa por intervalo, precisa ser rápida em 30 dias | hypertable de amostras tratadas + continuous aggregates (1 min, 15 min, 1 h) |

**Por que isso atende ao problema:**

1. **O cadastro é relacional de verdade.** Cliente → loja → ambiente → dispositivo, e usuários com perfis cujo escopo é um cliente ou um conjunto de lojas. FKs, unicidade e transações evitam estados inválidos, como um dispositivo apontando para um ambiente inexistente. O isolamento multi-tenant vira um filtro SQL sobre o escopo do token, e pode ser reforçado com Row-Level Security.
2. **Volume do dado cru (20 GB/dia em produção).** São cerca de 230 KB/s em média, folgado para inserção em lote no Postgres. A hypertable particiona por tempo em chunks diários, então inserção e consulta tocam só os chunks recentes. A compressão colunar nativa (segmentada por dispositivo e ordenada por tempo) costuma reduzir séries numéricas de sensor em mais de 90%, o que coloca 20 GB/dia na faixa de 1 a 2 GB/dia em disco. A retenção apaga chunks inteiros (`drop_chunks`), sem `DELETE` caro nem bloat.
3. **"Resposta rápida mesmo no período inteiro."** Os continuous aggregates materializam incrementalmente as janelas de 1 min, 15 min e 1 h. O gráfico de 30 dias lê cerca de 720 pontos horários por ambiente em vez de cerca de 86 mil amostras. A agregação em tempo real complementa a cauda ainda não materializada, então o dado novo aparece sem esperar o refresh.
4. **Pacotes atrasados (`saved_data`) e reprocessamento.** Os agregados são recalculados apenas nos buckets afetados pela janela de refresh. Uma chave única por amostra (`device_id`, `ts`) com `ON CONFLICT` torna a ingestão idempotente: rodar de novo não duplica nem corrompe.
5. **As regras de negócio cruzam série e cadastro.** "% do tempo dentro da faixa de conforto, no horário de funcionamento da loja, no fuso da loja, por ambiente e por loja, só nas lojas que o usuário pode ver" é um único `JOIN` em SQL. Com dois bancos, esse cruzamento iria para a aplicação.
6. **Operação e reprodutibilidade.** É um container, um backup, um pool de conexões e uma ferramenta de migração, e o projeto sobe com um comando.
7. **Tempo real sem infraestrutura extra.** `LISTEN/NOTIFY` do Postgres permite distribuir eventos da ingestão para várias instâncias da API sem adicionar Redis nesta escala.

**Alternativas consideradas:**

- **ClickHouse para o dado cru, Postgres para o cadastro.** É a alternativa mais forte para o cru em escala de TB/dia: ingestão e compressão superiores, ótimo para análise ad hoc. Pesou contra: dois motores para operar; deduplicação eventual (`ReplacingMergeTree` só deduplica no merge, o que complica a garantia de reprocessamento seguro); sem FKs nem transações; e os cruzamentos com o cadastro iriam para a aplicação. Com 20 GB/dia, o Timescale atende com folga.
- **InfluxDB.** É excelente para métricas, mas não serve para o cadastro (exigiria um segundo banco), tem joins limitados e passa por mudanças grandes entre versões (v1/v2/v3).
- **MongoDB (time series collections).** É flexível para JSON cru, mas fraco para o cadastro relacional e para as regras que cruzam série, horário de funcionamento e escopo do usuário.
- **Postgres puro, sem Timescale.** Exigiria particionamento manual (pg_partman), tabelas de agregação com refresh feito à mão e nenhuma compressão nativa.

**Caminho de evolução.** O PDF lembra que cru, séries e cadastro "não precisam estar no mesmo banco". A separação por schema e por repositórios na aplicação mantém essa fronteira explícita. Se o volume crescer em ordens de grandeza, o dado cru migra para object storage (S3 + Parquet) ou ClickHouse sem mexer no cadastro nem na API, e o Postgres segue servindo os agregados.

### Tempo real: Server-Sent Events (SSE)

O fluxo é unidirecional (servidor → navegador: novas leituras, mudanças de status), então SSE resolve sem o custo do WebSocket:

- é HTTP comum: passa por proxies e load balancers sem upgrade de protocolo e multiplexa sobre HTTP/2;
- reconecta automaticamente e retoma de onde parou com `Last-Event-ID`;
- o NestJS tem suporte nativo (`@Sse()` com Observables do RxJS);
- a autenticação usa o mesmo JWT da API. Como o `EventSource` nativo não envia headers, o cliente usa `fetch` com stream (`@microsoft/fetch-event-source`) e manda o `Authorization: Bearer`.

O WebSocket se justificaria com tráfego do cliente para o servidor em tempo real (por exemplo, comandos ao ar-condicionado), o que está fora do escopo. No nginx, o proxy de `/api` roda com `proxy_buffering off` para os eventos chegarem imediatamente.

### Autenticação e multi-tenant: JWT

O login devolve um JWT com `sub`, `role` (`DIEL_ADMIN`, `CLIENT_MANAGER`, `STORE_MANAGER`) e o escopo (`clientId`, `storeIds`). Um guard global valida o token, e um serviço de escopo traduz o perfil em filtro aplicado em toda consulta. Assim, o isolamento não depende de cada endpoint lembrar de filtrar, e testes automatizados cobrem o vazamento entre tenants.

### Qualidade dos dados: primeira análise de `telemetrias.jsonl`

180.951 pacotes de 12 amostras (`samplingTime` 30 s, `GMT` -3) entre 2026-01-12 e 2026-02-10:

| Achado | Ocorrências | Tratamento previsto |
| --- | --- | --- |
| Pacotes duplicados idênticos | 1.099 | chave única por amostra, dedupe idempotente |
| Pacotes enviados depois (`saved_data: true`) | 247 | inserção pelo timestamp da amostra e re-refresh dos agregados afetados |
| Pacotes fora de ordem por dispositivo | 217 | ordenação pelo tempo da amostra, não pela chegada |
| Leituras `-127.0` e `85.0` | 333 amostras fora de 0–50 °C | códigos de erro típicos do sensor DS18B20 (desconectado / reset); descartadas como espúrias e contabilizadas |
| Dispositivo `IOT099` | 481 pacotes | 26º dispositivo para 25 ambientes, provavelmente fora do cadastro: cru preservado, não entra nas séries |

## Testes

```bash
pnpm test                                      # unitários (backend + frontend)
pnpm --filter backend test:all                 # unitários + e2e do backend
```
