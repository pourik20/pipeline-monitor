'use server'

import { revalidatePath } from 'next/cache'
import { authContext } from '../auth-context'
import { pipelineService } from '../services/pipeline-service'
import { pipelineRunner } from '../services/pipeline-runner'
import { createPipelineSchema, type CreatePipelineInput, type PipelineDto } from '../schemas/pipeline'
import { logger } from '../logger'
import { toActionResult, type ActionResult } from './_result'
import type { JobRunDto } from '../schemas/run'

export async function createPipeline(
  input: CreatePipelineInput,
): Promise<ActionResult<PipelineDto>> {
  return toActionResult(async () => {
    const parsed = createPipelineSchema.parse(input)
    const user = await authContext.currentUser()
    const pipeline = await pipelineService.create(parsed, user)
    logger.info({ pipelineId: pipeline.id, name: pipeline.name }, 'pipeline created (action)')
    revalidatePath('/pipelines')
    return pipeline
  })
}

export async function deletePipeline(id: string): Promise<ActionResult<{ id: string }>> {
  return toActionResult(async () => {
    await pipelineService.deleteById(id)
    revalidatePath('/pipelines')
    return { id }
  })
}

export async function runPipeline(id: string): Promise<ActionResult<JobRunDto>> {
  return toActionResult(async () => {
    const run = await pipelineRunner.start(id)
    logger.info({ pipelineId: id, runId: run.id }, 'pipeline run started (action)')
    revalidatePath(`/pipelines/${id}`)
    revalidatePath('/runs')
    return run
  })
}
