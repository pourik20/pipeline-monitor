# Big Data Pipeline Monitor – Architektura

Školní projekt předmětu MSWA (Software Architecture). Cílem je navrhnout a implementovat systém pro monitorování datových pipeline. Aplikace simuluje orchestraci a monitoring – podobně jako Apache Airflow, Databricks Jobs nebo AWS Glue.

---

## Kontext a cíl

Aplikace slouží k evidenci a monitoringu datových pipeline nad datovými zdroji. Umožňuje spouštět pipeline, sledovat jejich běhy v reálném čase a upozorňovat na problémy prostřednictvím alertů.

Aplikace **neprovádí** skutečné distribuované výpočty. Běhy pipeline jsou simulované – cílem projektu je architektura aplikace, nikoli big data engine.

---

## Stack

| Vrstva           | Technologie                        |
| ---------------- | ---------------------------------- |
| Framework        | Next.js 15 (App Router, fullstack) |
| Jazyk            | TypeScript                         |
| Styling          | Tailwind CSS 4 + shadcn/ui         |
| Databáze         | MongoDB Atlas M0                   |
| ODM              | Mongoose                           |
| Validace (HTTP)  | Zod                                |
| Alert podmínky   | JSONata                            |
| Logování         | pino                               |
| Real-time        | Server-Sent Events (SSE)           |
| Hosting          | Vercel (Hobby)                     |

Aplikace je fullstack Next.js monolit – frontend i backend jsou součástí jednoho projektu nasazeného na Vercel. Backend je realizován pomocí Next.js Route Handlers, které tvoří REST API.

---

## Doménový model

```
User
 └─ owner                 Dataset ──< Pipeline ──< PipelineVersion
                                          │              │
                                          │              └──< (config snímek)
                                          │
                                          └──< JobRun ──< JobRunStep
                                          │
                                          └──< AlertRule ──< AlertEvent
```

| Entita            | Popis                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| `User`            | uživatel systému (admin/operator/viewer) – pouze pro `createdBy/owner` |
| `Dataset`         | evidovaný zdroj dat (metadata)                                         |
| `Pipeline`        | proces zpracování nad datasetem (stabilní identita)                    |
| `PipelineVersion` | konkrétní verze konfigurace pipeline (engine, query, simulační hinty)  |
| `JobRun`          | konkrétní běh pipeline (`pending → running → success/failed`)          |
| `JobRunStep`      | krok běhu (extract, transform, load)                                   |
| `AlertRule`       | pravidlo (JSONata podmínka) pro vznik alertu                           |
| `AlertEvent`      | vzniklá událost při splnění podmínky pravidla                          |

### Klíčové schéma polí

```ts
User             { _id, email, role: "admin"|"operator"|"viewer", createdAt }
Dataset          { _id, name, description, owner, schemaVersion, createdAt, updatedAt }
Pipeline         { _id, datasetId, name, description, schedule, active, createdBy, createdAt }
PipelineVersion  { _id, pipelineId, version, active, createdBy, createdAt,
                   config: {
                     engine: "spark" | ...,
                     query: string,                 // pouze pro zobrazení
                     simulation: {
                       steps: [{name, minDurationMs, maxDurationMs, recordsTarget}],
                       failureRate: number          // 0..1
                     }
                   } }
JobRun           { _id, pipelineId, pipelineVersionId, status, startedAt, finishedAt,
                   recordsProcessed, errorMessage,
                   plan: {                          // konkrétní hodnoty navzorkované při startu
                     steps: [{name, order, durationMs, recordsTarget}],
                     willFail: boolean,
                     failAtStepIndex: number | null
                   } }
JobRunStep       { _id, runId, order, name, status, startedAt, finishedAt, recordsProcessed }
AlertRule        { _id, pipelineId, name, condition: string /* JSONata */, enabled, createdBy, createdAt }
AlertEvent       { _id, ruleId, runId, message, createdAt }
```

`PipelineVersion.config.simulation` = recept (rozsahy). `JobRun.plan` = navzorkovaná konkrétní instance receptu.

### Doménová pravidla

- Pipeline lze spustit pouze pokud `Pipeline.active == true`
- Pipeline může mít pouze jednu aktivní verzi (`PipelineVersion.active == true`) – vynuceno servisou + partial unique indexem
- Pipeline nelze vytvořit nad neexistujícím datasetem
- JobRun přechází stavy pouze v povoleném směru: `pending → running → success/failed`
- AlertEvent vzniká pouze v rámci finalizace běhu, pokud JSONata podmínka pravidla vrátí `true`
- AlertEvent je idempotentní vůči `(ruleId, runId)` – partial unique index

---

## Komponentová architektura

Systém je rozdělen do pojmenovaných komponent, každá s jednou odpovědností. HTTP volání teče shora dolů, cross-cutting komponenty jsou injektovány.

```
┌─────────────────────────────────────┐  ┌────────────────────────┐
│            HTTP API Layer            │  │    Server Actions      │
│  Route Handlers · withErrorHandling  │  │  'use server' moduly   │
│  externí klienti, REST kontrakt      │  │  interní UI, ActionResult│
└─────────────────┬───────────────────┘  └─────────┬──────────────┘
                  │                                │
                  ▼                                ▼
            normalizeError()  ←  sdílený error mapper  →  toActionResult
                  │                                │
                  └──────────────┬─────────────────┘
                                 │
              ┌──────────────────┴───────┐
              │  Validation │  AuthContext│
              │  (Zod DTOs) │ (stub admin)│
              └──────────────────┬───────┘
                                 │
┌────────────────────────────────▼──────────────────────────────┐
│                  Doménové služby (jádro)                       │
│                                                                │
│  pipelineRunner ── pipelineVersionService                      │
│  runProgressTracker  (lazy-advance, čistá funkce + Clock)      │
│  runFinalizer ── alertEngine (JSONata) ── notifier             │
│  alertRuleService · runService (s terminate)                   │
│  AuthorizationService  (stub interface)                        │
│  Scheduler             (stub interface)                        │
│                                                                │
│  Core služby s Clock DI = factory funkce createXService({clock})│
│  Ostatní = plain object exporty. Žádné OOP třídy v doméně.     │
└────────────────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                    Persistence (Repositories)                    │
│  Carve-out: repozitáře jen pro netriviální dotazy                │
│  RunRepository, AlertRepository · ostatní entity volají Mongoose │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                  Mongoose / MongoDB Atlas

Cross-cutting:   Logger (pino) · Clock · RealtimeBroadcaster (SSE)
Čistá doména:    runState (state machine) · typy · alert kontext builder
```

| Komponenta              | Odpovědnost                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| **HTTP API Layer**      | Překlad HTTP ↔ servisní volání; jednotné mapování chyb                      |
| **Validation**          | Zod schémata na hranici – uvnitř už nikdo nedostane `unknown`                |
| **AuthContext**         | Stub: vrací seedovaného admina; v produkci NextAuth                          |
| **AuthorizationService**| Stub interface s `requireRole(user, role)`; není volán (RBAC vynechané)      |
| **pipelineRunner**      | Vytvoří `JobRun` se kompletním plánem (kroky, trvání, recordsTarget, failure)|
| **PipelineVersionService** | Vynucuje invariant „jedna aktivní verze na pipeline"                      |
| **RunProgressTracker**  | Lazy-advance: čistá funkce `(run, now) → materializovaný stav`               |
| **runFinalizer**        | Idempotentní terminální přechod; volá alertEngine + notifier                 |
| **AlertEngine**         | Kompiluje JSONata podmínky pravidel, vyhodnocuje proti běhu                  |
| **Notifier**            | Doručuje alerty (dev: log + insert AlertEvent; prod: email/Slack)            |
| **Scheduler**           | Stub interface – produkční řešení by byl cron worker                         |
| **Repositories**        | Skrývají Mongoose za interfacem (jen tam, kde je dotaz netriviální)          |
| **Logger** (pino)       | Strukturované logy, jeden interface, jedna implementace                      |
| **Clock**               | `now(): Date`, injektovaný – kvůli testovatelnosti lazy-advance              |
| **realtimeBroadcaster** | SSE – vlastní tickový loop, čte z runProgressTracker, emituje snapshoty      |
| **runState**            | Čistý modul – `canTransition`, `assertTransition`                            |

### Klíčová architektonická rozhodnutí

1. **Lazy-advance místo background workeru.** Stav běhu je čistá funkce `(plan, startedAt, now)`. Žádné cron jobs, žádné fronty. Při čtení run materializujeme aktuální bod plánu, na terminálním přechodu finalizujeme.
2. **`RunFinalizer` jako jediná cesta k terminálnímu stavu.** Volá ho jak `PATCH /runs/:id` (manuální ukončení), tak lazy-advance. Jeden bod, kde se vyhodnocují alert pravidla a vznikají AlertEventy.
3. **`AlertEngine` + `Notifier` rozdělené.** Engine *rozhoduje* (JSONata podmínka), Notifier *doručuje*. V dev jen loguje a insertuje řádek; produkční implementace by jen vyměnila Notifier.
4. **Konfigurace pipeline je verzovaná, run snímá plán.** `PipelineVersion.config.simulation` = recept s rozsahy. `JobRun.plan` = navzorkovaná konkrétní instance. Historické běhy zůstávají reprodukovatelné nezávisle na evoluci verzí.
5. **Carve-out repository pattern.** Repozitáře existují tam, kde dotaz nese smysl (filtrované běhy, alerty). Pro CRUD entity volají služby Mongoose přímo. Pragmatický kompromis dokumentovaný v `Záměrně vynecháno`.
6. **Server Actions vedle REST.** UI volá Server Actions (`lib/actions/`) — interní kanál s `ActionResult<T>` typem. Externí klienti jdou přes REST API. Obě vrstvy jsou tenké – Zod parse + servisní volání + revalidate / Response.json. Doménová logika existuje pouze ve službách. Validace a error mapování (`normalizeError`) jsou sdílené.
7. **Funkční styl.** Žádné OOP třídy v doméně. Služby s Clock DI jsou factory funkce `createXService({ clock })`. Ostatní jsou plain object exporty. Error třídy a Clock implementace zůstávají jako třídy (nominal types pro `instanceof`).
8. **Server boundary.** `lib/services/index.ts`, `lib/repositories/index.ts`, `lib/mongodb.ts` mají `import 'server-only'` — pokus naimportovat do client komponenty padne na build error.

---

## Vstupní vrstvy

Doména má dva tenké vstupy. Oba volají stejné služby v `lib/services/`.

**REST API** (`app/api/.../route.ts`) — externí klienti, stabilní HTTP kontrakt.
**Server Actions** (`lib/actions/*.ts` s `'use server'`) — interní UI mutace, volané z `'use client'` komponent přes `useTransition`. Vrací `ActionResult<T> = { ok: true, data } | { ok: false, error }` (žádné throw přes hranici).

```
lib/actions/
  _result.ts                  ActionResult<T> + toActionResult helper
  datasets.ts                 createDataset, deleteDataset
  pipelines.ts                createPipeline, deletePipeline, runPipeline
  pipeline-versions.ts        createPipelineVersion, activatePipelineVersion
  runs.ts                     terminateRun, retryRun
  alert-rules.ts              createAlertRule, setAlertRuleEnabled, deleteAlertRule
```

Server Actions volají `revalidatePath()` po úspěchu, RSC stránka se okamžitě překreslí. UI nepoužívá `fetch('/api/...')`.

## API endpointy

```
# Datasets
POST   /api/datasets
GET    /api/datasets
GET    /api/datasets/:id

# Pipelines
POST   /api/pipelines                  ← validuje existenci datasetu
GET    /api/pipelines
GET    /api/pipelines/:id
POST   /api/pipelines/:id/run          ← vytvoří JobRun s plánem, status=running

# Pipeline versions
POST   /api/pipelines/:id/versions
GET    /api/pipelines/:id/versions
PATCH  /api/pipelines/:id/versions/:versionId/activate

# Runs
GET    /api/runs                       ← cursor pagination, filtry: pipelineId, status, from, to
GET    /api/runs/:id                   ← lazy-advance materializace
PATCH  /api/runs/:id                   ← manuální ukončení (status, errorMessage)
GET    /api/runs/:id/stream            ← SSE stream živého stavu

# Alert rules
POST   /api/alert-rules                ← validuje JSONata kompilací
GET    /api/alert-rules
GET    /api/alert-rules/:id

# Alert events
GET    /api/alerts                     ← cursor pagination
GET    /api/alerts/:id
```

### Konvence

- **Validace**: Zod na vstupu route handleru. Chyba → 400 s `{error: {code: "validation", details: [...]}}`.
- **Chybové třídy**: `ValidationError(400)`, `NotFoundError(404)`, `ConflictError(409)`, `BusinessRuleError(422)`, `ForbiddenError(403)`. Mapuje je `withErrorHandling`.
- **Pagination**: cursor-based `?limit=50&cursor=<lastId>` na `/runs` a `/alerts`.
- **`createdBy`**: stamping z `AuthContext.getCurrentUser()` (vždy admin v dev).

---

## Simulace běhu (lazy-advance)

Žádný background worker, žádný cron. Stav `JobRun` je odvozený z `plan` + `startedAt` + aktuální čas.

**Vznik runu** (`POST /pipelines/:id/run`):
1. `PipelineRunner` najde aktivní `PipelineVersion`
2. Z `config.simulation` se seedovaným RNG navzorkuje plán: konkrétní `durationMs` a `recordsTarget` pro každý krok, `willFail`, `failAtStepIndex`
3. Plán se uloží do `JobRun.plan`. Run startuje ve stavu `running`, `startedAt = now`.

**Materializace na čtení** (`RunProgressTracker.materialize(run, now)`):
- Vrátí aktuální stav: index aktivního kroku, progress kroku (0..1), `recordsProcessed` agregace, status (`running` nebo terminální).
- Pokud výpočet ukáže terminální stav, předá běh `RunFinalizer` (idempotentní `findOneAndUpdate({_id, status: "running"}, ...)`).
- Pure funkce vůči stavu DB v okamžiku čtení – závisí jen na `Clock.now()`.

**Ukončení**: jediný bod – `RunFinalizer.finalize(run, {reason})`. Manuální (PATCH) i automatické (lazy-advance) cestou. Po úspěšném update volá `AlertEngine.evaluate(run)`, výsledky předá `Notifier`.

**Demo cap**: simulované běhy ≤ ~45 s wall-clock, aby se vešly do limitu serverless funkce (Vercel Hobby ~60 s, SSE běží na Node runtime kvůli Mongoose).

---

## Real-time monitoring

`GET /api/runs/:id/stream` (SSE):
- Tick každých 1.5 s.
- Emituje **plný snapshot** (idempotentní render) – status, currentStepIndex, currentStepProgress, recordsProcessed.
- Při terminálním přechodu emituje finální snapshot a uzavře spojení.
- Otevření streamu na již dokončený běh: jeden snapshot a uzavře (200, ne 4xx).

SSE bylo zvoleno místo WebSocket – jednosměrná komunikace server → klient, bez nutnosti perzistentního obousměrného spojení.

---

## UI architektura

**App Router, Server Components defaultně, klientské ostrůvky pro interaktivitu.**

Mutace jdou přes `fetch('/api/...')` z klientských komponent (REST API je jediný behaviorální kontrakt). RSC stránky volají servisy přímo na serveru – obejde HTTP, ale doménová vrstva je HTTP-agnostická.

```
app/
  page.tsx                         Dashboard (RSC)
  datasets/                        seznam, detail, formulář
  pipelines/                       seznam, detail (s kroky a alerty)
  runs/
    page.tsx                       seznam s filtry (RSC + ?pipeline&status&from&to)
    [id]/page.tsx                  detail (RSC + <RunDetailLive>)
  alerts/
  api/                             REST routes

components/
  runs/RunFilters.tsx              "use client" – filtry → router.replace
  runs/RunDetailLive.tsx           "use client" – EventSource konzument
  forms/*                          "use client" – formuláře
```

**Filtry** v URL search params (sdílitelné, back-button).
**Live detail**: RSC načte snapshot, pokud je status `running`, vykreslí `<RunDetailLive>` který otevře SSE.

### Obrazovky (z assignmentu)

1. Dashboard – počty datasetů, pipeline, aktivních pipeline, běhů za období, failed běhů, otevřených alertů
2. Seznam datasetů – tabulka, akce
3. Seznam pipeline – tabulka s názvem, datasetem, schedule, active, posledním stavem
4. Detail pipeline – metadata, verze, aktivní stav, schedule, seznam běhů, přehled alertů
5. Seznam běhů – pipeline, status, startedAt, finishedAt, runtime, recordsProcessed; filtry
6. Detail běhu – metadata + seznam JobRunStep + stav každého kroku (live pokud běží)
7. Seznam alertů – pipeline, run, message, createdAt

---

## Indexy

```
Pipeline           {datasetId: 1}, {active: 1}
PipelineVersion    {pipelineId: 1, active: 1}  partial: active=true (UNIQUE)
JobRun             {pipelineId: 1, startedAt: -1}, {status: 1, startedAt: -1},
                   {pipelineVersionId: 1}
JobRunStep         {runId: 1, order: 1}
AlertRule          {pipelineId: 1, enabled: 1}
AlertEvent         {runId: 1}, {ruleId: 1}, {createdAt: -1}
                   {ruleId: 1, runId: 1}  UNIQUE (idempotence)
User               {email: 1}  UNIQUE
```

---

## Seed data

`scripts/seed.ts` (`pnpm seed`):
- 1 user `admin@demo` (role admin)
- 5 datasetů (taxi domain – vehicle_telemetry, trip_records, charging_sessions, customer_events, fleet_incidents)
- 6 pipeline s 1–2 verzemi každá
- ~20 historických JobRun napříč success/failed
- 1 JobRun aktuálně ve stavu `running` (aby SSE měla co ukazovat)
- 3–4 AlertRule s JSONata podmínkami (`runtime > 600000`, `status = 'failed'`)
- ~5 historických AlertEvent

Idempotentní (drop kolekcí na začátku).

---

## Záměrně vynecháno

| Funkce                       | Zdůvodnění                                                              | Produkční řešení                            |
| ---------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| Autentizace (AuthN)          | mimo rozsah; `AuthContext` vrací seedovaného admina                     | NextAuth.js + JWT                           |
| Autorizace (AuthZ)           | RBAC modelováno (`User.role`), `AuthorizationService` jako stub interface | volání `requireRole()` v route handlerech |
| Scheduler (cron)             | běhy spouštěny jen ručně; `Scheduler` interface existuje                | Vercel Cron / dedikovaný worker             |
| Skutečné výpočty             | simulace stačí pro architektonický cíl                                  | Spark, Databricks                           |
| Plné repository pokrytí      | jen carve-out pro netriviální dotazy                                    | repository per aggregate                    |
| WebSockets                   | SSE pokrývá use case (server → klient)                                  | SignalR / WebSocket                         |
| Docker                       | Vercel deploy nepotřebuje                                               | Dockerfile + container registry             |

---

## Doménový scénář

Aplikace je zasazena do prostředí společnosti poskytující autonomní taxi služby s vozovým parkem elektromobilů Tesla. Vozidla generují různorodá provozní data zpracovávaná datovými pipeline.

### Datasety

| Dataset             | Popis                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `vehicle_telemetry` | senzorová data – GPS, rychlost, stav baterie, teplota, autopilot události |
| `trip_records`      | záznamy jízd – zákazník, trasa, čas vyzvednutí/doručení, hodnocení, cena  |
| `charging_sessions` | nabíjecí relace – stanice, čas, spotřeba kWh, stav baterie před/po        |
| `customer_events`   | chování zákazníků – objednávky, zrušení, stížnosti, hodnocení             |
| `fleet_incidents`   | incidenty – kolize, nouzová zastavení, výpadky autopilota                 |

### Příklady pipeline

| Pipeline                     | Dataset             | Schedule          |
| ---------------------------- | ------------------- | ----------------- |
| `daily-trip-aggregation`     | `trip_records`      | každý den ve 2:00 |
| `battery-health-monitor`     | `vehicle_telemetry` | každou hodinu     |
| `charging-cost-report`       | `charging_sessions` | každý týden       |
| `customer-churn-detection`   | `customer_events`   | každý den ve 3:00 |
| `incident-severity-analysis` | `fleet_incidents`   | každých 15 minut  |
| `route-efficiency-scoring`   | `trip_records`      | každý den ve 4:00 |

### Příklad kroků pipeline

`daily-trip-aggregation`:

```
extract   → načtení surových trip_records za posledních 24h
transform → výpočet průměrné doby jízdy, tržeb, hodnocení, ujetých km
load      → uložení agregátů do výsledné kolekce
```

### Příklady alert pravidel (JSONata)

| Název                 | Condition                             |
| --------------------- | ------------------------------------- |
| Run failed            | `status = 'failed'`                   |
| Runtime exceeded 10m  | `runtime > 600000`                    |
| Long run + low yield  | `runtime > 300000 and recordsProcessed < 1000` |
