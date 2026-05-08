import '@/lib/server-init'
import type mongoose from 'mongoose'
import { systemClock, type Clock } from '@/lib/shared/clock'
import { assertTransition, type RunStatus } from '@/lib/runs/run-state'
import { runRepository } from '@/lib/runs/run-repository'
import { bus } from '@/lib/events'

export interface FinalizeArgs {
  reason: 'success' | 'failed'
  errorMessage?: string
  recordsProcessed?: number
}

export interface RunFinalizer {
  finalize(
    runId: mongoose.Types.ObjectId,
    currentStatus: RunStatus,
    args: FinalizeArgs,
  ): Promise<boolean>
}

export function createRunFinalizer(deps: { clock: Clock } = { clock: systemClock }): RunFinalizer {
  const { clock } = deps

  return {
    async finalize(runId, currentStatus, args) {
      assertTransition(currentStatus, args.reason)

      const finishedAt = clock.now()
      const update: Record<string, unknown> = { status: args.reason, finishedAt }
      if (args.errorMessage !== undefined) update.errorMessage = args.errorMessage
      if (args.recordsProcessed !== undefined) update.recordsProcessed = args.recordsProcessed

      const doc = await runRepository.finalizeRunningRun(runId, update as never)
      if (!doc) return false

      bus.publish({
        type: 'runFinalized',
        runId: doc._id,
        pipelineId: doc.pipelineId,
        pipelineVersionId: doc.pipelineVersionId,
        status: args.reason,
        startedAt: doc.startedAt ?? null,
        finishedAt,
        recordsProcessed: (args.recordsProcessed ?? doc.recordsProcessed) as number,
        errorMessage: (args.errorMessage ?? doc.errorMessage) as string | null,
      })

      return true
    },
  }
}

export const runFinalizer = createRunFinalizer()
