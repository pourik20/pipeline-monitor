# pipeline-monitor — domain context

A demo backend for monitoring data-engineering job pipelines. Built as a
Next.js 16 (App Router) monolith with MongoDB (Mongoose). Pipelines are
versioned; each run is a simulated job whose progress is computed lazily
from a sampled plan and the wall clock.

## Bounded contexts

The codebase is organized by **bounded context** under `lib/`. Each context
owns its model, repository, service, schema, and DTOs. Cross-context
collaboration happens either through Server Actions / API routes (the
external contract) or through the in-process event bus (`lib/events/`).

| Context     | Responsibility                                                   | Folder              |
| ----------- | ---------------------------------------------------------------- | ------------------- |
| `pipelines` | Pipelines and their immutable versions                           | `lib/pipelines/`    |
| `runs`      | Job run lifecycle: start, materialize progress, finalize         | `lib/runs/`         |
| `alerts`    | Alert rules, JSONata evaluation, alert event log                 | `lib/alerts/`       |
| `datasets`  | Dataset registry referenced by pipelines                         | `lib/datasets/`     |
| `events`    | Typed in-process event bus (cross-context glue)                  | `lib/events/`       |
| `shared`    | Cross-cutting infra: clock, logger, mongodb, errors, auth-context | `lib/shared/`       |

The `lib/actions/` folder is the Server Action entry point for the UI; the
`app/api/` folder is the REST entry point for external clients (ADR-0001).
Both call into the same context services — there is no duplicated logic.

## Layers within a context

Inside each context the file naming reflects classical layering:

```
<context>/
  <name>-model.ts        # Mongoose schema + types
  <name>-repository.ts   # All Mongoose calls live here
  <name>-service.ts      # Domain operations, orchestration, error throwing
  <name>-schema.ts       # Zod input/output schemas + DTO types
```

Some contexts add domain helpers (e.g. `runs/plan-sampler.ts`,
`runs/run-state.ts`, `runs/progress-tracker.ts`, `alerts/evaluator.ts`).
These are pure functions — easy to test without a database.

## Domain language

- **Pipeline** — a named, versioned job definition tied to a dataset. Has
  exactly one *active* version at a time (ADR-0002).
- **PipelineVersion** — an immutable snapshot of pipeline config (engine,
  query, simulation parameters) used by every run started against it.
- **JobRun** — a single execution of a pipeline against an active version.
  Its `plan` (sampled at start) is embedded in the document and is the
  single source of truth for materialization (ADR-0003).
- **Plan** — the deterministic schedule of `steps` for a run, plus optional
  failure injection (`willFail`, `failAtStepIndex`). Sampled once at start
  using a random seed so the simulation is reproducible per run.
- **Materialized snapshot** — the current per-step state of a run, computed
  on demand from `plan` and `now()`. Never persisted (ADR-0003).
- **AlertRule** — a JSONata expression (ADR-0004) evaluated against a run's
  snapshot. Owned by a pipeline.
- **AlertEvent** — a record that a rule matched a run. The unique index
  `(ruleId, runId)` provides natural deduplication so a rule fires at most
  once per run regardless of how many times it is evaluated.

## Two entry points, one core (ADR-0001)

- **REST routes** in `app/api/` — the behavioural contract for external
  clients. Each handler is a thin adapter: parse + service call + map errors.
- **Server Actions** in `lib/actions/` — the entry point for UI mutations.
  Same shape; same services. Returns `ActionResult<T>` so client code never
  throws across the server boundary.

## Events (ADR-0005)

`lib/events/` provides a typed, in-process event bus. Three events:

- `runFinalized` — published by `runs/run-finalizer`
- `runProgressed` — published whenever a running run is materialized
- `alertFired` — published by `alerts/recorder` when a new alert event is
  persisted

`alerts` is the only domain subscriber today. The SSE stream route attaches
a transient `alertFired` listener for the duration of a connection so it can
push alert names to the client in real time.

## See also

- `docs/architecture/` — diagrams (bounded contexts, layered request flow,
  run lifecycle / events, data model)
- `docs/adr/` — the architectural decisions that shaped this layout
