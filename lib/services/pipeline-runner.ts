import { BusinessRuleError } from '../errors'
import { systemClock, type Clock } from '../clock'
import { pipelineService } from './pipeline-service'
import { samplePlan } from '../domain/plan-sampler'
import { runRepository } from '../repositories/run-repository'
import { pipelineVersionRepository } from '../repositories/pipeline-version-repository'
import { runToDto } from './run-mappers'
import type { JobRunDto } from '../schemas/run'

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

      if (plan.steps.length > 0) {
        await runRepository.createSteps(
          plan.steps.map((s) => ({
            runId: run._id,
            order: s.order,
            name: s.name,
            status: 'pending' as const,
            recordsProcessed: 0,
          })),
        )
      }

      return runToDto(run)
    },
  }
}

export const pipelineRunner = createPipelineRunner()
