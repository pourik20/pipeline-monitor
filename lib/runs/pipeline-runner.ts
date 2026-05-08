import { BusinessRuleError } from '@/lib/shared/errors'
import { systemClock, type Clock } from '@/lib/shared/clock'
import { pipelineService } from '@/lib/pipelines/pipeline-service'
import { samplePlan } from '@/lib/runs/plan-sampler'
import { runRepository } from '@/lib/runs/run-repository'
import { pipelineVersionRepository } from '@/lib/pipelines/pipeline-version-repository'
import { runToDto } from '@/lib/runs/run-mappers'
import type { JobRunDto } from '@/lib/runs/run-schema'

export interface PipelineRunner {
  start(pipelineId: string): Promise<JobRunDto>
}

export function createPipelineRunner(deps: { clock: Clock } = { clock: systemClock }): PipelineRunner {
  const { clock } = deps

  return {
    async start(pipelineId) {
      const pipeline = await pipelineService.requireById(pipelineId)

      if (!pipeline.active) {
        throw new BusinessRuleError(`Pipeline ${pipelineId} is not active`)
      }

      const activeVersion = await pipelineVersionRepository.getActive(pipelineId)
      if (!activeVersion) {
        throw new BusinessRuleError(`Pipeline ${pipelineId} has no active version`)
      }

      const seed = `${String(activeVersion._id)}:${clock
        .now()
        .getTime()}:${Math.floor(Math.random() * 0xffffffff)}`
      const plan = samplePlan(activeVersion.config.simulation, seed)

      const startedAt = clock.now()
      const run = await runRepository.create({
        pipelineId: pipeline._id,
        pipelineVersionId: activeVersion._id,
        status: 'running',
        startedAt,
        finishedAt: null,
        recordsProcessed: 0,
        errorMessage: null,
        plan,
      })

      return runToDto(run)
    },
  }
}

export const pipelineRunner = createPipelineRunner()
