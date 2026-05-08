# Data model

MongoDB collections and their relationships. Modeling rule of thumb: data
read together is embedded; data referenced from many places is its own
collection (see ADR-0003 for run plan, ADR-0005 for alert events).

```mermaid
erDiagram
    User ||--o{ Pipeline : "createdBy"
    User ||--o{ Dataset : "owner / createdBy"
    User ||--o{ AlertRule : "createdBy"

    Dataset ||--o{ Pipeline : "datasetId"
    Pipeline ||--o{ PipelineVersion : "pipelineId"
    Pipeline ||--o| PipelineVersion : "exactly one active"
    Pipeline ||--o{ AlertRule : "pipelineId"
    Pipeline ||--o{ JobRun : "pipelineId"
    PipelineVersion ||--o{ JobRun : "pipelineVersionId"

    AlertRule ||--o{ AlertEvent : "ruleId"
    JobRun ||--o{ AlertEvent : "runId"

    JobRun {
        ObjectId _id
        ObjectId pipelineId
        ObjectId pipelineVersionId
        string status "pending|running|success|failed"
        Date startedAt
        Date finishedAt
        number recordsProcessed
        string errorMessage
        Plan plan "EMBEDDED"
    }

    Plan {
        PlanStep[] steps "EMBEDDED array"
        boolean willFail
        number failAtStepIndex
    }

    PlanStep {
        string name
        number order
        number durationMs
        number recordsTarget
    }

    AlertRule {
        ObjectId _id
        ObjectId pipelineId
        string name
        string condition "JSONata expression"
        boolean enabled
    }

    AlertEvent {
        ObjectId _id
        ObjectId ruleId
        ObjectId runId
        string message
        Date createdAt
    }
```

## Embedded vs referenced — the choices

- **`Plan` is embedded inside `JobRun`.** The plan is sampled once at run
  start (`samplePlan`) and never read outside the context of its run. There
  is no cross-run query that needs to filter on plan steps. Embedding makes
  the run document self-contained and keeps materialization a pure function
  of one document.
- **`AlertEvent` is its own collection.** Events are listed across all runs
  on `/alerts`, deduplicated via the unique `(ruleId, runId)` index, and
  drive the `alertFired` event in the bus. Embedding them inside `JobRun`
  would make cross-run listing awkward and the unique index impossible.
- **`PipelineVersion` is its own collection** (ADR-0002). Versions are
  immutable snapshots; embedding them inside `Pipeline` would force the
  pipeline document to grow unboundedly.
- **No separate `JobRunStep` collection.** The materialized step state is
  derived from `Plan` + `now()` (ADR-0003) and never persisted. An earlier
  draft of the schema had a `JobRunStep` collection; it was removed because
  it was written but never read.
