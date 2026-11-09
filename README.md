# Celsius 360 (versão reduzida): desafio técnico Diel Energia

Sistema que recebe telemetria crua de sensores IoT de temperatura como se chegasse em tempo real, armazena, enriquece com as regras de negócio (status, conforto térmico no horário de funcionamento) e mostra a situação da rede numa aplicação web.

> **Status:** funcionalidades obrigatórias (seção 2.2 do desafio) implementadas: cadastro, ingestão contínua, enriquecimento, API documentada e as duas telas. Dos diferenciais, o **tempo real com Server-Sent Events** está implementado ([desenho](#tempo-real-server-sent-events)); JWT/multi-tenant e temperatura externa estão descritos em [Próximos passos](#próximos-passos).

![Visão da rede](docs/screenshots/network-overview.png)

## Como rodar do zero

Pré-requisito: Docker com Compose v2.

```bash
docker compose up --build
```

A subida faz tudo sozinha, nesta ordem:

1. **db**: PostgreSQL 16 + TimescaleDB.
2. **backend**: aplica as migrações, carrega `data/cadastro.json` (seed idempotente) e sobe a API.
3. **ingestor**: lê `data/telemetrias.jsonl` linha a linha, em ordem, a 2.000 pacotes/s (cerca de 90 s para o arquivo inteiro), e termina. As telas se atualizam sozinhas enquanto a ingestão roda (o indicador "Ao vivo" no cabeçalho mostra a conexão de tempo real); o andamento fica em `GET /api/ingestion/status`.
4. **frontend**: build do React servido por nginx, com proxy de `/api` para o backend.

| Serviço | URL |
| --- | --- |
| Aplicação web | http://localhost:8080 |
| API | http://localhost:8080/api (ou http://localhost:3000/api) |
| Documentação OpenAPI (Swagger) | http://localhost:8080/api/docs |
| PostgreSQL/TimescaleDB | `localhost:5434` |

Outros comandos úteis:

```bash
# reprocessar o arquivo do início (idempotente: não duplica nada)
docker compose run --rm -e INGEST_FROM_START=true ingestor

# ingestão sem limite de taxa (cerca de 2.700 pacotes/s numa máquina de desenvolvimento)
INGEST_PACKETS_PER_SECOND=0 docker compose up --build

# zerar tudo, incluindo os dados
docker compose down -v
```

As portas e parâmetros podem ser trocados via `.env` (veja `.env.example`). Os defaults do `docker-compose.yml` servem só para uso local; nenhuma credencial real é versionada.

### Desenvolvimento local (fora do Docker)

```bash
pnpm install
docker compose up -d db
export DATABASE_URL=postgres://celsius:celsius_local@localhost:5434/celsius360
export JWT_SECRET=local-dev-only-secret-change-me
pnpm --filter backend migrate:dev
pnpm --filter backend seed:dev
pnpm --filter backend ingest:dev   # em outro terminal, ou em paralelo com a API
pnpm dev:backend                   # http://localhost:3000
pnpm dev:frontend                  # http://localhost:5173 (proxy /api -> :3000)
```

## Testes

```bash
pnpm test                                       # unitários do backend e do frontend
docker compose up -d db                         # os testes de integração usam um TimescaleDB real
pnpm --filter backend test:all                  # unitários + integração + e2e
pnpm --filter backend test:cov                  # tudo, com cobertura
pnpm --filter frontend test -- --coverage
```

| | Suítes | Testes | Cobertura (statements / branches) |
| --- | --- | --- | --- |
| Backend | 34 | 210 | 98,6% / 94,9% |
| Frontend | 15 | 91 | 99,8% / 97,1% |

- **Unitários** (`backend/test/unit`, espelhando `backend/src`): regras de domínio puras (horário de funcionamento por fuso, qualidade da leitura, conforto, status, resolução), serviços com fakes das portas e parser do cadastro.
- **Integração** (`backend/test/integration`): cada suíte cria um banco novo no TimescaleDB, aplica as migrações e exercita o caminho real: seed do cadastro, ingestão (duplicatas, pacotes atrasados, retomada pelo checkpoint, reprocessamento sem alterar contagens), read models sobre os continuous aggregates, a API HTTP com supertest e o tempo real (os `NOTIFY` de cada lote chegam pelo `LISTEN`, um stream SSE de verdade recebe os eventos e é encerrado quando a API desliga).
- **Frontend**: React Testing Library contra uma API falsa injetada por contexto, cobrindo filtros na URL, ordenação, paginação, expansão de lojas, troca de período, lacunas no gráfico, estados de erro e as atualizações em tempo real (com um `EventSource` falso).
- O Jest falha se a cobertura cair abaixo de 95% (statements, funções, linhas) ou 90% (branches), nos dois projetos.
- **CI** (`.github/workflows/ci.yml`): lint, typecheck, testes com cobertura e build de cada projeto (o backend com um serviço TimescaleDB), mais um smoke test que sobe o `docker compose` e consulta o health check.

## Arquitetura

```mermaid
flowchart LR
  jsonl[/"telemetrias.jsonl"/] --> ingestor
  cadastro[/"cadastro.json"/] --> seed

  subgraph backend["backend (NestJS)"]
    seed["migrações + seed"]
    api["API REST + SSE<br/>/api/stores, /api/zones/...,<br/>/api/events"]
  end

  ingestor["ingestor (NestJS standalone)<br/>parse → qualidade → enriquecimento<br/>lote transacional + checkpoint"]

  subgraph db["PostgreSQL 16 + TimescaleDB"]
    cad[("registry.*<br/>clientes, lojas, ambientes,<br/>dispositivos, usuários")]
    raw[("raw.packets<br/>hypertable, pacote cru")]
    samples[("telemetry.samples<br/>hypertable, 1 linha por leitura válida")]
    caggs[("zone_1m → zone_15m → zone_1h<br/>continuous aggregates")]
    state[("ingestion.device_state<br/>ingestion.checkpoints")]
  end

  seed --> cad
  ingestor --> raw & samples & state
  ingestor -. "lê ambiente, faixa e horário" .-> cad
  samples --> caggs
  api --> cad & caggs & state
  ingestor -. "pg_notify a cada lote" .-> api
  web["web (React + Vite, nginx)"] -- "/api (REST e SSE)" --> api
```

- **Dois processos com a mesma imagem.** A API e o ingestor compartilham o código do backend, mas rodam separados: a ingestão pode parar, reiniciar ou escalar sem derrubar a API, e um pico de leitura na API não atrasa a ingestão.
- **Portas e adaptadores.** Os módulos dependem de abstrações (`IngestionStore`, `TelemetrySource`, `ZoneDirectoryLoader`, `IngestionNotifier`, `NetworkReadModel`, `ZonesReadModel`, `IngestionFeed`, `ReferenceClock`...), registradas como tokens de injeção do Nest. As implementações Postgres ficam nas bordas, e as regras de negócio são funções e classes puras, testadas sem banco.
- **Organização do backend** (`backend/src`):

  | Módulo | Responsabilidade |
  | --- | --- |
  | `shared/time` | fuso horário, horário semanal, períodos (`1d`, `7d`, `30d`) |
  | `shared/events` | contrato do evento de progresso da ingestão (canal e formato do `NOTIFY`) |
  | `telemetry/domain` | parser do pacote, política de qualidade (DS18B20), classificação de conforto |
  | `registry` | parser e validação do `cadastro.json`, gravação idempotente, `GET /customers` |
  | `ingestion` | fonte JSONL, controle de taxa, enriquecimento, persistência em lote, aviso de lote gravado, runner, entrypoint |
  | `monitoring` | regras de status e resolução, read models, serviços e controllers da API, tempo real (SSE) |

  Dentro de cada módulo (e de cada funcionalidade de `monitoring`: `stores`, `zones`, `ingestion-status`, `live`):

  - `controllers/`: rotas HTTP, sem regra de negócio;
  - `services/`: casos de uso, que dependem só das portas;
  - `interfaces/`: portas (classes abstratas usadas como token de injeção, como `NetworkReadModel`, `IngestionStore` e `DatabaseHealth`) e os tipos de dados que elas trocam;
  - `repositories/`: implementações das portas (`pg-*.ts`, `jsonl-file.source.ts`, `map-zone-directory.ts`);
  - `domain/`: regras puras, sem Nest nem banco (por exemplo `zone-range.ts` lança `InvalidRangeError`, e o service traduz para HTTP 400);
  - `parsers/`: validação do `cadastro.json`;
  - `dto/`: entrada validada pelo `ValidationPipe` (`*.query.dto.ts`) e contratos de resposta documentados no Swagger (`*.response.dto.ts`);
  - na raiz do módulo, só o `*.module.ts` (que liga cada porta à sua implementação) e os entrypoints de processo.

  Regras e contratos compartilhados entre módulos ficam em `shared/time` e `shared/events`. O `src` contém só código de produção; testes, fakes e fixtures ficam em `backend/test`.

- **Organização do frontend** (`frontend/src`): `api/` (cliente HTTP, API tipada, hooks do TanStack Query, conexão de tempo real), `components/` (badge, medidor de conforto, seletor de período, paginação), `features/network` e `features/zone` (as duas telas, com a lógica pura separada em `*-params.ts` e `chart-data.ts`).

## API

Documentação interativa em `/api/docs` (OpenAPI gerado a partir dos DTOs). Todas as respostas usam o "agora" da ingestão como referência (`referenceTime`).

| Método e rota | O que devolve |
| --- | --- |
| `GET /api/stores` | Lojas com status, indicadores do período e ambientes; resumo da rede. Filtros `customerId`, `search` (nome, cidade ou código), `status`; ordenação `sort` (`name`, `city`, `status`, `comfort`, `outOfRange`) e `order`; paginação `page` e `pageSize` (até 100); período `period` (`1d`, `7d`, `30d`). |
| `GET /api/zones/:zoneId/series` | Série de temperatura (média, mínima, máxima e nº de leituras por bucket), faixa de conforto e lacunas. `period` ou `from` + `to` (ISO 8601, até 92 dias). A resolução é escolhida pelo tamanho do intervalo. |
| `GET /api/zones/:zoneId/summary` | Ambiente, loja, cliente, dispositivo, leitura atual e indicadores do período: % na faixa, abaixo e acima, média, mínima, máxima, disponibilidade, lacunas e leituras descartadas. |
| `GET /api/customers` | Clientes com quantidade de lojas (alimenta o filtro). |
| `GET /api/events` | Stream `text/event-stream` (Server-Sent Events). Evento `ingestion` (`{ referenceTime, zoneIds }`, no máximo um por segundo) quando a ingestão grava dados novos; `zoneIds` nulo significa "qualquer ambiente". Evento `heartbeat` a cada 25 s para manter a conexão aberta em proxies. |
| `GET /api/ingestion/status` | Checkpoint por arquivo, totais (pacotes crus, amostras, leituras descartadas, linhas inválidas) e dispositivos fora do cadastro. |
| `GET /api/health` | Saúde da API e do banco. |

Parâmetros inválidos devolvem `400` com a lista de erros (validação por DTO com `class-validator`, `whitelist` e `forbidNonWhitelisted`); ambiente inexistente devolve `404`.

## Regras de negócio

| Regra | Definição |
| --- | --- |
| **"Agora"** | Instante do último pacote processado pela ingestão (o maior `timestamp` já visto; um pacote atrasado não faz o relógio voltar). Sem ingestão, usa o relógio do servidor. "Último dia" e "última semana" são `[agora − 1 d, agora]` e `[agora − 7 d, agora]`. |
| **Leitura válida** | Número finito, diferente dos códigos de erro do DS18B20 (`-127`: sensor desconectado; `85`: valor de power-on reset) e dentro de −10 °C a 60 °C. As descartadas ficam registradas com o motivo. |
| **Instante de cada leitura** | O `timestamp` do pacote (hora local, com `GMT`) é o instante da última leitura; as anteriores ficam a `samplingTime` segundos de distância. |
| **Horário de funcionamento** | Janela `[abertura, fechamento)` por dia da semana, no fuso da loja. O horário do ambiente, quando existe, substitui o da loja. Janelas que atravessam a meia-noite são rejeitadas no cadastro. |
| **Conforto** | Dentro da faixa se `mín ≤ temperatura ≤ máx` (limites inclusivos); senão, abaixo ou acima. |
| **Status do dispositivo** | `online` se o último pacote chegou até 15 min antes de "agora" (2,5× o intervalo normal de 6 min: tolera um pacote perdido); `offline` se faz mais tempo; `no_data` se nunca enviou. |
| **Situação do ambiente** | `unknown` se o dispositivo não está online ou a última leitura válida tem mais de 15 min (por exemplo, o sensor só manda `-127`); `closed` fora do horário de funcionamento; senão `below`, `within` ou `above`. "Fora da faixa agora" conta os ambientes `below` e `above`. |
| **Status da loja** | `online` se todos os dispositivos estão online; `offline` se nenhum está; `partial` se parte está; `no_data` se nenhum nunca reportou. Na ordenação por status, a mais crítica vem primeiro (offline, parcial, sem dados, online). |
| **% de conforto no período** | Leituras dentro da faixa ÷ leituras válidas no horário de funcionamento. Na loja, soma as leituras de todos os ambientes. Lacunas não contam nem como dentro nem como fora; aparecem à parte, como disponibilidade. |
| **Lacuna** | Intervalo de 15 min ou mais sem nenhuma leitura válida, inclusive no começo e no fim do período. Disponibilidade = 1 − tempo em lacuna ÷ duração do período. |
| **Resolução da série** | Até 36 h: buckets de 1 min; até 8 dias: 15 min; acima: 1 h. Assim, 1 dia tem cerca de 1.440 pontos, 7 dias 672 e 30 dias 720. |

## Decisões e trade-offs

### Banco de dados: PostgreSQL 16 + TimescaleDB

Escolhi **um único motor, PostgreSQL com a extensão TimescaleDB**, com os três tipos de dado separados em schemas e tabelas com padrões de acesso próprios:

| Dado | Natureza | Onde fica |
| --- | --- | --- |
| Cadastro (clientes, lojas, ambientes, dispositivos, usuários) | relacional, pequeno, muda pouco, exige integridade | schema `registry`, tabelas comuns com FKs e constraints |
| Dado cru (pacotes como chegaram do broker) | append-only, alto volume, lido só para auditoria e reprocessamento | `raw.packets`, hypertable com chunks diários |
| Séries tratadas e agregadas | leitura intensa por intervalo, precisa ser rápida em 30 dias | `telemetry.samples` (hypertable) + continuous aggregates de 1 min, 15 min e 1 h |

**Por que isso atende ao problema:**

1. **O cadastro é relacional de verdade.** Cliente → loja → ambiente → dispositivo, e usuários com perfis cujo escopo é um cliente ou um conjunto de lojas. FKs, unicidade e `CHECK`s evitam estados inválidos: dispositivo apontando para ambiente inexistente, faixa de conforto com mínimo maior que o máximo, coordenadas fora do globo, `admin_diel` vinculado a um cliente ou `gestor_cliente` sem cliente.
2. **Volume do dado cru (20 GB/dia em produção).** São cerca de 230 KB/s em média, folgado para inserção em lote no Postgres. A hypertable particiona por tempo em chunks diários, então inserção e consulta tocam só os chunks recentes. A compressão colunar nativa (já configurada: segmentada por dispositivo, ordenada por tempo) costuma reduzir séries de sensor em mais de 90%, o que coloca 20 GB/dia na faixa de 1 a 2 GB/dia em disco. A retenção apaga chunks inteiros (`drop_chunks`), sem `DELETE` caro nem bloat.
3. **"Resposta rápida mesmo no período inteiro."** Os continuous aggregates materializam incrementalmente as janelas de 1 min, 15 min e 1 h, e cada nível é calculado a partir do anterior. O gráfico de 30 dias lê 720 pontos horários em vez de cerca de 86 mil amostras: com o arquivo inteiro carregado, a série responde em 30 a 70 ms em qualquer período, e a lista de lojas em 30 dias em cerca de 15 ms.
4. **Pacotes atrasados e reprocessamento.** A chave única por amostra (`device_id`, `ts`) com `ON CONFLICT DO NOTHING` torna a ingestão idempotente. Os agregados guardam somas e contagens, não médias, então um pacote atrasado só invalida os buckets em que cai, e o Timescale recalcula apenas esses.
5. **As regras cruzam série e cadastro.** "% do tempo na faixa, no horário da loja, no fuso da loja, por ambiente e por loja" é SQL sobre o mesmo banco. Com dois bancos, esse cruzamento iria para a aplicação.
6. **Operação e reprodutibilidade.** É um container, um backup, um pool de conexões e uma ferramenta de migração, e o projeto sobe com um comando.

**Alternativas consideradas:**

- **ClickHouse para o dado cru, Postgres para o cadastro.** É a alternativa mais forte para o cru em escala de TB/dia: ingestão e compressão superiores, ótimo para análise ad hoc. Pesou contra: dois motores para operar; deduplicação eventual (`ReplacingMergeTree` só deduplica no merge, o que complica a garantia de reprocessamento seguro); sem FKs nem transações; e os cruzamentos com o cadastro iriam para a aplicação. Com 20 GB/dia, o Timescale atende com folga.
- **InfluxDB.** É excelente para métricas, mas não serve para o cadastro (exigiria um segundo banco), tem joins limitados e passa por mudanças grandes entre versões (v1/v2/v3).
- **MongoDB (time series collections).** É flexível para JSON cru, mas fraco para o cadastro relacional e para as regras que cruzam série, horário de funcionamento e escopo do usuário.
- **Postgres puro, sem Timescale.** Exigiria particionamento manual (pg_partman), tabelas de agregação com refresh feito à mão e nenhuma compressão nativa.

**Caminho de evolução.** O desafio lembra que cru, séries e cadastro "não precisam estar no mesmo banco". A separação por schema e por portas na aplicação (`IngestionStore`, read models) mantém essa fronteira explícita. Se o volume crescer em ordens de grandeza, o dado cru migra para object storage (S3 + Parquet) ou ClickHouse sem mexer no cadastro nem na API, e o Postgres segue servindo os agregados.

**Compressão e retenção não estão ativadas, de propósito.** As políticas automáticas do Timescale comparam a idade do chunk com o relógio real, e o arquivo do desafio é de janeiro e fevereiro de 2026: ativá-las comprimiria (ou apagaria) tudo logo na carga, e comprimir antes de os pacotes atrasados chegarem encarece o `ON CONFLICT`. Em produção, a configuração seria: comprimir `raw.packets` e `telemetry.samples` após 7 dias, reter o cru por 90 dias e manter os agregados indefinidamente.

### Modelagem

- **Cadastro.** `customers`, `stores` (cidade, UF, latitude e longitude com `CHECK`, fuso IANA validado, horário semanal em `jsonb`), `zones` (faixa de conforto em `numeric(4,1)`, horário opcional), `devices` (`zone_id` único: um dispositivo por ambiente) e `users` (perfil por `CHECK`, e-mail único sem diferenciar maiúsculas) com `user_stores` para o gerente de loja. O horário fica em `jsonb` porque é lido inteiro, nunca filtrado por SQL, e assim o cadastro continua legível.
- **Seed idempotente.** O `cadastro.json` é validado por completo antes de gravar (tipos, referências entre entidades, perfis, unicidade, horários). Todos os erros são relatados de uma vez, e a gravação é um upsert numa transação. Rodar de novo atualiza sem duplicar.
- **Dado cru.** Cada linha do arquivo vira uma linha em `raw.packets`, com o JSON original em `jsonb`, inclusive duplicatas e pacotes de dispositivos fora do cadastro. A chave `(source, line_no, sent_at)` impede que reprocessar a mesma linha duplique o cru. Linhas que nem são JSON válido vão para `raw.rejected_lines`.
- **Amostras tratadas.** Uma linha por leitura válida: `(ts, device_id, zone_id, temperature, business_hours, comfort)`. O enriquecimento acontece na escrita: o ingestor já grava se a leitura caiu no horário de funcionamento e se estava abaixo, dentro ou acima da faixa. Os agregados viram contagens simples e as leituras ficam baratas. O custo: mudar a faixa ou o horário de um ambiente não reclassifica o histórico sozinho (ver [Próximos passos](#próximos-passos)).
- **Estado da ingestão.** `ingestion.device_state` guarda primeiro e último pacote e última leitura válida por dispositivo (base do status), e `ingestion.checkpoints` guarda a última linha processada e o "agora".

### Tratamento dos dados

Análise de `telemetrias.jsonl` e resultado após a ingestão completa:

| Achado | Ocorrências | Tratamento |
| --- | --- | --- |
| Pacotes | 180.951 de 12 leituras (`samplingTime` 30 s, `GMT` −3), de 12/01 a 10/02/2026 | todos preservados no cru |
| Pacotes duplicados idênticos | 1.099 | preservados no cru; as leituras repetidas são ignoradas pela chave `(device_id, ts)` |
| Pacotes enviados depois (`saved_data: true`) | 247 | gravados pelo instante da leitura; os buckets afetados são recalculados |
| Pacotes fora de ordem por dispositivo | 217 | a ordem de chegada não importa: tudo é indexado pelo instante da leitura, e o status usa `GREATEST` |
| Leituras `-127.0` e `85.0` | 333 | códigos de erro do DS18B20; descartadas com motivo e contadas por ambiente ("leituras descartadas") |
| Dispositivo `IOT099` | 481 pacotes | fora do cadastro: preservado no cru, fora das séries, listado em `/api/ingestion/status` |
| Lacunas | 373 buracos de 12 min (um pacote perdido) e quedas de 2 a 6 h | os de 12 min não derrubam o status (limite de 15 min); os maiores aparecem como lacunas no gráfico e na disponibilidade |

Resultado: 180.951 pacotes crus, 2.152.132 leituras válidas e 332 descartadas (uma das 333 estava num pacote duplicado). Reprocessar o arquivo do início mantém exatamente essas contagens.

### Ingestão

- **Contínua e em ordem.** O ingestor lê o arquivo com `readline` (memória constante, independente do tamanho) e controla a taxa (`INGEST_PACKETS_PER_SECOND`) para simular o broker; `0` desliga o limite.
- **Lotes atômicos.** A cada `INGEST_BATCH_SIZE` linhas, uma única transação grava cru, linhas inválidas, amostras, leituras descartadas, estado dos dispositivos e checkpoint, com inserção em massa via `unnest`. Se o processo cair no meio, o lote inteiro é desfeito, e a próxima execução retoma da última linha confirmada.
- **Idempotente.** Toda escrita é `ON CONFLICT DO NOTHING` ou um upsert monotônico (`LEAST`/`GREATEST`), então reprocessar (`INGEST_FROM_START=true`) ou sobrepor execuções não duplica nem regride nada.
- **Desligamento limpo.** `SIGTERM`/`SIGINT` terminam o lote corrente e param; o checkpoint fica consistente.
- **Vazão.** Sem limite de taxa, cerca de 2.700 pacotes/s numa máquina de desenvolvimento, gargalo no banco. Com pacotes de cerca de 160 bytes (a média do arquivo), os 20 GB/dia de produção dão cerca de 1.500 pacotes/s em média: cabe num ingestor, mas com pouca folga para picos. Para escalar, o caminho é ler do broker com partições por `dev_id` e um ingestor por partição: o estado por dispositivo não precisa de coordenação entre eles.

### API e regras no serviço

- **Status calculado na aplicação.** O read model faz uma consulta que traz os fatos de cada ambiente (último pacote, última leitura, contagens de conforto do período no agregado da resolução certa), e o `NetworkService` aplica as regras, filtra por status, ordena e pagina em memória. As regras ficam num só lugar, testadas sem banco, e o custo é linear no número de ambientes: para centenas de lojas (alguns milhares de ambientes), dezenas de milissegundos.
- **Quando isso deixar de bastar:** o ingestor passa a manter uma tabela de status por ambiente, e filtro, ordenação e paginação (por cursor) descem para o SQL.
- **Consistência.** Os agregados usam agregação em tempo real (`materialized_only = false`): uma leitura nova aparece na hora, mesmo antes do refresh. Um pacote atrasado que cai num bucket já materializado aparece depois do próximo refresh (30 s, 1 min e 2 min, nos três níveis).

### Tempo real (Server-Sent Events)

- **Por que SSE.** O fluxo é unidirecional (servidor → navegador), então WebSocket não traria nada além de complexidade: SSE é HTTP comum, atravessa proxies, reconecta sozinho e o Nest tem suporte nativo (`@Sse()`). O nginx faz proxy de `/api` com `proxy_buffering off` e timeout de 1 h.
- **Do ingestor à API pelo Postgres.** Depois de confirmar cada lote, o ingestor chama `pg_notify('ingestion_progress', ...)` com a última linha, o "agora" e os ambientes afetados (porta `IngestionNotifier`). A API escuta com `LISTEN` (porta `IngestionFeed`). Não há broker extra: o banco que os dois processos já usam faz a ponte, e o evento só sai depois do `COMMIT`, quando os dados já estão visíveis para as consultas.
- **Uma conexão para todos os navegadores.** A API abre uma única conexão `LISTEN`, compartilhada por todos os streams (`share()` do RxJS): ela abre com o primeiro navegador, fecha quando o último sai e, se cair, reconecta após 2 s.
- **Agrupamento.** Com 2.000 pacotes/s, a ingestão confirma vários lotes por segundo. A API junta os avisos em janelas de 1 s (maior "agora" e união dos ambientes), então cada navegador recebe no máximo um evento por segundo. Acima de 300 ambientes num lote, o aviso diz só "qualquer ambiente", para caber no limite de 8 kB do `NOTIFY`.
- **No navegador.** O evento invalida as consultas afetadas do TanStack Query: a lista de lojas sempre, e o resumo e a série só dos ambientes citados. Uma requisição em andamento não é reiniciada, para que eventos frequentes não impeçam a consulta de terminar. Na atualização em tempo real, os painéis não ficam esmaecidos como na troca de filtro; o efeito visual fica reservado para mudanças pedidas pelo usuário.
- **Sem replay, e por isso sem perda.** O aviso é só um gatilho: os dados vêm sempre da API. Depois de uma reconexão, o navegador invalida tudo, cobrindo os eventos perdidos. Por isso o `NOTIFY` pode ser best effort: se falhar, o ingestor registra um aviso e segue, e a ingestão nunca para por causa do tempo real. Se o servidor responder com erro (por exemplo, 502 enquanto a API reinicia), o `EventSource` desiste; nesse caso o cliente abre uma nova conexão após 5 s.
- **Indicador.** O cabeçalho mostra "Ao vivo", "Conectando…" ou "Reconectando…" (com `role="status"`), para o usuário saber se os números podem estar desatualizados.

### Aplicação web

- **React 18 + Vite + TanStack Query.** Cache por chave de consulta, cancelamento da requisição anterior ao trocar de filtro e `keepPreviousData` para a tabela e o gráfico não piscarem ao paginar ou trocar de período.
- **Filtros na URL.** Busca, cliente, status, período, ordenação e página ficam na query string: o link é compartilhável e o botão voltar funciona. Mudar um filtro volta para a página 1, e a busca espera 300 ms de pausa na digitação.
- **Feita para centenas de lojas.** Paginação no servidor (20 por página); os ambientes de cada loja abrem sob demanda; o resumo da rede (lojas por status, ambientes online, fora da faixa, conforto) vem calculado do servidor.
- **Detalhe do ambiente rápido em qualquer período.** A resolução vem do backend, então o navegador desenha no máximo cerca de 1.440 pontos. As lacunas aparecem como faixas cinza, com a linha interrompida, e são listadas com início, fim e duração. Os horários aparecem no fuso da loja.
- **Carregamento.** A tela de detalhe (com a biblioteca de gráficos, Recharts) é carregada sob demanda: o bundle inicial tem 218 kB (70 kB com gzip).
- **Identidade visual Diel.** Cores, tipografia e logotipo extraídos de dielenergia.com: azul `#363BC4` e variações escuras no cabeçalho, verde `#00FF9B` como destaque e na faixa de conforto, cinzas neutros, Inter (auto-hospedada via `@fontsource`, sem CDN externa) e o logotipo SVG oficial.
- **Acessibilidade.** Medidores com `role="meter"`, cabeçalhos com `aria-sort`, seletor de período como `radiogroup`, linhas expansíveis com `aria-expanded` e foco visível.

| Visão da rede | Detalhe do ambiente (7 dias, com uma lacuna) | Detalhe do ambiente (30 dias) |
| --- | --- | --- |
| ![](docs/screenshots/network-overview.png) | ![](docs/screenshots/zone-7d.png) | ![](docs/screenshots/zone-30d.png) |

### Glossário do código

O código (identificadores, comentários e descrições dos testes) usa inglês: `registry` = cadastro, `customer` = cliente, `store` = loja, `zone` = ambiente, `device` = dispositivo, `comfort band` = faixa de conforto, `business hours` = horário de funcionamento, `gap` = lacuna. Textos de interface, documentação da API e mensagens de erro ficam em português. O `cadastro.json` é lido no formato do desafio (chaves, dias da semana e códigos de perfil em português).

## Próximos passos

Diferenciais do desafio ainda não implementados, com o desenho previsto:

- **Autenticação JWT e multi-tenant.** Login devolvendo um JWT com perfil e escopo (`customerId`, lojas), guard global e um serviço de escopo que injeta o filtro em todos os read models (o `StoreFilter` já recebe `customerId`), com testes de vazamento entre clientes. O cadastro já modela perfis e vínculos; `JWT_SECRET` já é exigido na configuração.
- **Temperatura externa (Open-Meteo).** Coleta horária por coordenada da loja, numa tabela própria, sobreposta ao gráfico.
- **Reprocessamento com reclassificação.** Hoje o reprocessamento é seguro (não duplica), mas não reclassifica leituras já gravadas. Para aplicar uma nova faixa ou um novo horário ao histórico: reclassificar `telemetry.samples` do ambiente no período (`UPDATE` por chunk) e chamar `refresh_continuous_aggregate` na mesma janela.
- **Operação.** Ativar as políticas de compressão e retenção, adicionar métricas da ingestão (Prometheus: atraso em relação ao broker, pacotes/s, descartes) e alertas.
