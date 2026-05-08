import '@/lib/server-init'
import { ConflictError, NotFoundError } from '@/lib/shared/errors'
import { systemClock } from '@/lib/shared/clock'
import { runRepository, type FindFilteredArgs } from '@/lib/runs/run-repository'
import { assertTransition } from '@/lib/runs/run-state'
import { materialize, type RunForMaterialization, type MaterializedSnapshot } from '@/lib/runs/progress-tracker'
import { runFinalizer } from '@/lib/runs/run-finalizer'
import { runToDto } from '@/lib/runs/run-mappers'
import { bus } from '@/lib/events'
import type { JobRunDoc } from '@/lib/runs/job-run-model'
import type { JobRunDto, RunDetailWithSnapshot } from '@/lib/runs/run-schema'

export interface TerminateRunArgs {
  status: 'success' | 'failed'
  errorMessage?: string
}

function toMaterializationInput(doc: JobRunDoc): RunForMaterialization {
  return {
    id: String(doc._id),
    startedAt: doc.startedAt ? new Date(doc.startedAt) : null,
    status: doc.status,
    recordsProcessed: doc.recordsProcessed,
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt) : null,
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
  }
}

function publishProgress(doc: JobRunDoc, snapshot: MaterializedSnapshot) {
  bus.publish({
    type: 'runProgressed',
    runId: doc._id,
    pipelineId: doc.pipelineId,
    pipelineVersionId: doc.pipelineVersionId,
    status: snapshot.status,
    startedAt: doc.startedAt ?? null,
    finishedAt: snapshot.finishedAt ? new Date(snapshot.finishedAt) : null,
    recordsProcessed: snapshot.recordsProcessed,
    errorMessage: snapshot.errorMessage,
    steps: snapshot.steps.map((s) => ({
      name: s.name,
      order: s.order,
      status: s.status,
      recordsProcessed: s.recordsProcessed,
    })),
  })
}

export const runService = {
  async list(args: {
    pipelineId?: string
    status?: FindFilteredArgs['status']
    from?: string
    to?: string
    limit: number
    cursor?: string
  }): Promise<{ items: JobRunDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await runRepository.findFiltered({
      pipelineId: args.pipelineId,
      status: args.status,
      from: args.from ? new Date(args.from) : undefined,
      to: args.to ? new Date(args.to) : undefined,
      limit: args.limit,
      cursor: args.cursor,
    })
    return { items: items.map(runToDto), nextCursor }
  },

  async getById(id: string): Promise<RunDetailWithSnapshot> {
    const run = await runRepository.findById(id)
    if (!run) throw new NotFoundError(`Run ${id} not found`)

    const snapshot = materialize(toMaterializationInput(run), systemClock.now())

    if (run.status === 'running') {
      publishProgress(run, snapshot)

      if (snapshot.status === 'success' || snapshot.status === 'failed') {
        runFinalizer
          .finalize(run._id, 'running', {
            reason: snapshot.status,
            errorMessage: snapshot.errorMessage ?? undefined,
            recordsProcessed: snapshot.recordsProcessed,
          })
          .catch(() => {})
      }
    }

    const runDto = runToDto(run)
    runDto.status = snapshot.status
    runDto.recordsProcessed = snapshot.recordsProcessed
    if (snapshot.finishedAt) runDto.finishedAt = snapshot.finishedAt
    if (snapshot.errorMessage) runDto.errorMessage = snapshot.errorMessage

    return { run: runDto, snapshot }
  },

  async terminate(
    id: string,
    args: TerminateRunArgs,
  ): Promise<{ id: string; status: 'success' | 'failed' | 'running' }> {
    const doc = await runRepository.findById(id)
    if (!doc) throw new NotFoundError(`Run ${id} not found`)

    if (doc.status === args.status) {
      return { id: String(doc._id), status: doc.status }
    }
    if (doc.status === 'success' || doc.status === 'failed') {
      throw new ConflictError(`Run is already in terminal state: ${doc.status}`)
    }

    assertTransition(doc.status, args.status)

    const snapshot = materialize(toMaterializationInput(doc), systemClock.now())

    await runFinalizer.finalize(doc._id, doc.status, {
      reason: args.status,
      errorMessage: args.errorMessage,
      recordsProcessed: snapshot.recordsProcessed,
    })

    return { id: String(doc._id), status: args.status }
  },
}
