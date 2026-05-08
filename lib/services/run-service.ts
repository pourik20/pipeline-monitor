import { ConflictError, NotFoundError } from '../errors'
import { systemClock } from '../clock'
import { runRepository, type FindFilteredArgs } from '../repositories/run-repository'
import { assertTransition } from '../domain/runState'
import { materialize, type RunForMaterialization } from './run-progress-tracker'
import { runFinalizer } from './run-finalizer'
import { runToDto } from './run-mappers'
import type { JobRunDto, RunDetailWithSnapshot } from '../schemas/run'

export interface TerminateRunArgs {
  status: 'success' | 'failed'
  errorMessage?: string
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

    const runForMat: RunForMaterialization = {
      id: String(run._id),
      startedAt: run.startedAt ? new Date(run.startedAt) : null,
      status: run.status,
      recordsProcessed: run.recordsProcessed,
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      errorMessage: run.errorMessage ?? null,
      plan: {
        steps: run.plan.steps.map((s) => ({
          name: s.name,
          order: s.order,
          durationMs: s.durationMs,
          recordsTarget: s.recordsTarget,
        })),
        willFail: run.plan.willFail,
        failAtStepIndex:
          typeof run.plan.failAtStepIndex === 'number' ? run.plan.failAtStepIndex : null,
      },
    }

    const snapshot = materialize(runForMat, systemClock.now())

    if (run.status === 'running' && (snapshot.status === 'success' || snapshot.status === 'failed')) {
      runFinalizer
        .finalize(run._id, 'running', {
          reason: snapshot.status,
          errorMessage: snapshot.errorMessage ?? undefined,
          recordsProcessed: snapshot.recordsProcessed,
        })
        .catch(() => {})
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

    const snapshot = materialize(
      {
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
      },
      systemClock.now(),
    )

    await runFinalizer.finalize(doc._id, doc.status, {
      reason: args.status,
      errorMessage: args.errorMessage,
      recordsProcessed: snapshot.recordsProcessed,
    })

    return { id: String(doc._id), status: args.status }
  },
}
