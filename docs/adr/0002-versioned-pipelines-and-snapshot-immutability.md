# ADR-0002: Versioned pipelines and run-snapshot immutability

- **Status**: Accepted
- **Date**: 2026-05-07

## Context

A `Pipeline` is the stable, named identity of a data process over a dataset.
Its configuration — engine, query, simulation hints — evolves over time as
operators tune step durations, add transforms, or change the failure profile.

Two pressures pull on the design:

1. **Forward evolution.** Operators must be able to change configuration
   without disrupting the pipeline's identity (its `_id`, its name, its
   alert rules, its history of runs).
2. **Backward reproducibility.** A run that completed last week must remain
   interpretable next month, even after configuration has been edited
   several times. "What did this run actually do?" must have a deterministic
   answer.

A single mutable `Pipeline.config` document satisfies (1) but breaks (2):
yesterday's run loses the context it executed under as soon as someone
edits the configuration today.

## Decision

We split the pipeline aggregate into two collaborating models, and we
snapshot configuration at run start.

1. **`Pipeline` holds identity and meta**: `datasetId`, `name`,
   `description`, `schedule`, `active`, `createdBy`. It does **not** hold
   the simulation/engine config.

2. **`PipelineVersion` holds configuration**: `pipelineId`, `version`,
   `active`, `config = {engine, query, simulation: {steps, failureRate}}`.
   New versions are appended; old versions are never mutated in place.

3. **One active version per pipeline.** Enforced at two layers:
   - Service layer: `PipelineVersionService.activate(versionId)` is the
     only path that flips `active`. It deactivates the prior active
     sibling first, then activates the target.
   - Storage layer: a partial unique index
     `{pipelineId: 1, active: 1}` filtered to `active=true` rejects any
     state where two versions of the same pipeline are active. The index
     is the safety net for concurrent or buggy callers; the service is
     the ergonomic path.

4. **Run-snapshot immutability (decision recorded now, used in slice 3).**
   When `PipelineRunner` creates a `JobRun`, it samples concrete values
   from the active version's `config.simulation` and writes them to
   `JobRun.plan` — a flat, fully-resolved record of `{steps[], willFail,
   failAtStepIndex}`. The run never reads `PipelineVersion.config` again
   after it starts. Future edits to the version, or even deletion of the
   version, do not disturb historical runs.

## Consequences

**Positive**

- A pipeline's history is reproducible: each run carries the exact plan
  it executed under, independent of subsequent config drift.
- Configuration changes are cheap and additive — create a new version,
  flip the active flag — instead of a destructive in-place edit.
- The "one active version" invariant is double-enforced (service + index),
  so a buggy concurrent caller cannot leave the system in an inconsistent
  state.
- Alert rules continue to attach to the stable `Pipeline._id`, not to a
  specific configuration; they survive version transitions naturally.

**Negative**

- Two collections instead of one — slightly more code, two more indexes.
- The detail UI must compose data from both `Pipeline` and the active
  `PipelineVersion`. Mitigated by RSC pages calling services directly.
- Disk usage grows linearly in run count (each `JobRun.plan` carries its
  own snapshot). Acceptable for a monitoring/demo workload.

**Follow-ups**

- Slice 3 implements `PipelineRunner` and writes `JobRun.plan`.
- Slice 3+ may add a "deprecate version" flag to hide stale versions in
  the UI without breaking the foreign-key relationship from historical
  runs.
