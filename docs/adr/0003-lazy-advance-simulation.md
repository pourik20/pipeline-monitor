# ADR-0003: Lazy-advance simulation strategy

- **Status**: Accepted
- **Date**: 2026-05-07

## Context

This system simulates the execution of data pipelines — it does not run
real distributed jobs. Each `JobRun` represents a wall-clock progression
through a sequence of `JobRunStep`s, each with a sampled duration and a
records target. The simulation must:

1. Show **live progress** in the UI while a run is "in flight" (a
   step-by-step view that visibly advances).
2. Survive deployment to **Vercel Hobby** (serverless functions, no
   long-lived processes, ~60 s execution cap).
3. Remain **deterministic and reproducible** — replays of the same run
   in different sessions must show the same trajectory.
4. Keep the **operational footprint small** — no message queues, no
   schedulers, no dedicated workers. The school project is about
   architecture, not distributed runtime.

The natural implementation in a "real" system would be a background
worker (cron / queue / dedicated container) that ticks each running job
forward, writes intermediate state to the database, and finalizes on
completion. That implementation is incompatible with constraints (2)
and (4), and overkill for (1) and (3).

## Decision

We adopt a **lazy-advance** strategy:

1. At run-start time, the `PipelineRunner` samples a complete plan from
   `PipelineVersion.config.simulation` using a seeded RNG and persists
   it on `JobRun.plan`. The plan contains every step's concrete
   `durationMs`, `recordsTarget`, plus `willFail` and
   `failAtStepIndex`. From this point on, the run's full trajectory
   is determined.
2. The run is persisted with `status: "running"`, `startedAt = now()`,
   and one `JobRunStep(status: "pending")` row per planned step.
3. **There is no background worker.** The "current state" of a run is
   computed by a pure function `materialize(run, now)` that reads the
   plan, the start timestamp, and the current clock — and returns the
   active step index, per-step progress, aggregate
   `recordsProcessed`, and a status (`running` or terminal).
4. When `materialize` reports a terminal state, a `RunFinalizer`
   performs the terminal write via an atomic
   `findOneAndUpdate({_id, status: "running"}, {...})`. This makes the
   transition idempotent and race-safe under concurrent reads.

Slice 3 lands the plan-snapshot half of this contract: sampler,
`JobRun.plan`, `pending` step rows, and immutable run metadata. The
materializer and finalizer are scheduled for slice 4.

## Architectural bets

- **No background worker.** State derives from the persisted plan
  plus the wall clock. There is nothing to schedule, scale, or
  recover from a crash. Reads alone advance the world.
- **Plan-snapshot determinism.** Because the plan is sampled once and
  persisted, every subsequent materialization for a given run is a
  pure function over immutable inputs. Replaying produces the same
  output. Configuration evolution on the underlying
  `PipelineVersion` does not retroactively reshape historical runs.
- **Race-safe terminal updates.** Two concurrent readers can both
  observe a run that has just crossed into a terminal state. The
  `findOneAndUpdate({status: "running"}, ...)` predicate guarantees
  exactly one of them succeeds; the other reads the already-finalized
  document. Alert evaluation therefore runs at most once per run.

## Consequences

### Positive

- Trivially deployable on Vercel Hobby — no long-running compute.
- Tests for the materializer become pure-function tests against an
  injectable `Clock`. No fakes for queues or workers.
- Run history is reproducible from `(plan, startedAt, finishedAt)`
  alone.

### Negative

- A run that is never read after starting will *never* finalize.
  Alerts attached to a forgotten run won't fire on their own. We
  accept this for the school project; production would add a cheap
  cron tick (`Scheduler` interface stub) to nudge stale runs.
- Wall-clock-bound runs must stay under the SSE-stream lifetime
  (~60 s on Vercel Hobby). Demo seed plans cap total duration at
  ~45 s.
- The "live" UI state lags slightly behind the strict mathematical
  state — it advances only when a client reads. In practice the
  open SSE stream polls every 1.5 s, which is well within the
  perceptual budget.

## Alternatives considered

- **Background cron worker.** Standard answer; rejected for (2) and
  (4). Documented as the production replacement via the `Scheduler`
  stub interface.
- **Eager pre-computation of all step rows.** Persist each step's
  `startedAt`/`finishedAt` at run-start time so reads need no
  derivation. Rejected: it bakes wall-clock interpretation into
  storage, making clock skew, manual cancellation, and replay
  awkward. The plan-snapshot + lazy materialization pair separates
  *intent* (immutable) from *interpretation* (recomputed on demand).
- **Database triggers / TTL-driven finalization.** MongoDB does not
  give us reliable time-driven side-effects of the right shape, and
  it would introduce a hidden actor outside the application
  boundary.

## Out of scope for slice 3

- The materializer (`RunProgressTracker`) and `RunFinalizer` land in
  slice 4 alongside the SSE stream and alert evaluation.
- The `Scheduler` interface is recorded as a stub only; no
  implementation is wired.
