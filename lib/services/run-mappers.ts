import type { JobRunDoc } from '../models/job-run'
import type { JobRunStepDoc } from '../models/job-run-step'
import type { JobRunDto, JobRunStepDto } from '../schemas/run'

export function runToDto(doc: JobRunDoc): JobRunDto {
  const created = (doc as unknown as { createdAt: Date }).createdAt
  const updated = (doc as unknown as { updatedAt: Date }).updatedAt
  return {
    id: String(doc._id),
    pipelineId: String(doc.pipelineId),
    pipelineVersionId: String(doc.pipelineVersionId),
    status: doc.status,
    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt).toISOString() : null,
    recordsProcessed: doc.recordsProcessed,
    errorMessage: doc.errorMessage ?? null,
    plan: {
      steps: doc.plan.steps.map((s) => ({
        name: s.name,
        order: s.order,
        durationMs: s.durationMs,
        recordsTarget: s.recordsTarget,
      })),
      willFail: doc.plan.willFail,
      failAtStepIndex:
        typeof doc.plan.failAtStepIndex === 'number' ? doc.plan.failAtStepIndex : null,
    },
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString(),
  }
}

export function stepToDto(doc: JobRunStepDoc): JobRunStepDto {
  return {
    id: String(doc._id),
    runId: String(doc.runId),
    order: doc.order,
    name: doc.name,
    status: doc.status,
    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt).toISOString() : null,
    recordsProcessed: doc.recordsProcessed,
  }
}
