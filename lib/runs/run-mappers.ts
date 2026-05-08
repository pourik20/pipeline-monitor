import type { JobRunDoc } from '@/lib/runs/job-run-model'
import type { JobRunDto } from '@/lib/runs/run-schema'

export function runToDto(doc: JobRunDoc): JobRunDto {
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}
