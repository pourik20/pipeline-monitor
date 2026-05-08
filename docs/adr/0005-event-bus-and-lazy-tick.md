# ADR-0005: In-process event bus with lazy progress tick

- **Status**: Accepted
- **Date**: 2026-05-08

## Context

After the initial implementation, alert evaluation lived directly inside
`runs/run-finalizer` and was duplicated again inside the SSE stream route.
This created two problems:

1. **Tight coupling** between the `runs` and `alerts` bounded contexts.
   `runs` could not finalize a job without knowing how alerts are evaluated
   and recorded, which made `alerts` impossible to remove or replace in
   isolation and forced the `runs` module to depend on the JSONata evaluator
   and the alert repository.
2. **Mid-run alerts were not possible.** Alert rules with conditions that are
   meaningful while a run is still in progress (e.g. `runtime > 7200000` for a
   long-running job) only fired *after* finalization. ADR-0003 established
   that run state is materialized lazily on read; there is no background
   process advancing run state, so there was no natural place to evaluate
   alerts mid-run.

## Decision

Introduce an **in-process, typed event bus** in `lib/events/`. Domains
publish facts about themselves; other domains subscribe.

Three event types:

| Event             | Publisher                         | Meaning                                 |
| ----------------- | --------------------------------- | --------------------------------------- |
| `runFinalized`    | `runs/run-finalizer`              | A run transitioned to `success`/`failed` |
| `runProgressed`   | `runs/run-service`, SSE stream    | A running run was just materialized     |
| `alertFired`      | `alerts/recorder`                 | A new alert event was persisted         |

`alerts/index.ts` subscribes to `runFinalized` and `runProgressed` at module
import time and runs the same `evaluateAndRecord` orchestration for both.
Subscribers are registered once at server startup via `instrumentation.ts`.

`runProgressed` events are emitted **lazily on read** — wherever a running run
is materialized (`runService.getById`, the SSE stream tick). There is
deliberately no background tick (cron, worker). This is consistent with
ADR-0003: no work happens unless a client is observing.

Idempotency is preserved by the unique index `(ruleId, runId)` on the
`AlertEvent` collection. The recorder checks whether the upsert actually
inserted before publishing `alertFired`, so the SSE listener and any future
subscriber receive each alert exactly once even though the same rule may
match on many `runProgressed` events plus the final `runFinalized`.

## Consequences

**Positive:**
- `runs` no longer imports `alerts`. Dependency direction is enforced via the
  bus, not type imports.
- Mid-run alerts work: opening a run-detail page or keeping the SSE stream
  open is enough to evaluate alerts against the live snapshot.
- Adding a new subscriber (audit log, webhook, metric counter) is one file
  with no changes to publishers.
- The SSE stream route is no longer a duplicate of the alert orchestration
  in the finalizer — it just listens to `alertFired` for its run id.

**Negative / accepted limitations:**
- Lazy tick means alerts fire only when *somebody is looking*. A long-running
  pipeline whose run page is never opened will only have alerts evaluated at
  finalization. This is an explicit choice for the demo scope; a future
  cron-driven `tickRunningRuns` subscriber can be added without changing any
  publishers.
- The bus is in-process. If the app is ever split across multiple instances,
  events would need to move to a real broker (Redis Streams, NATS, Vercel
  Queues). The typed event shapes are designed to be serializable so that
  migration is mechanical.
- Subscribers run after `Promise.resolve()`; failures are caught and logged
  but do not propagate to the publisher. This is desirable for `runs` (we
  don't want alert failures to block run finalization) but means subscribers
  must own their own retry/observability strategy.
