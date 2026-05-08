'use server'

import { revalidatePath } from 'next/cache'
import { authContext } from '@/lib/shared/auth-context'
import { pipelineService } from '@/lib/pipelines/pipeline-service'
import { pipelineRunner } from '@/lib/runs/pipeline-runner'
import { createPipelineSchema, type CreatePipelineInput, type PipelineDto } from '@/lib/pipelines/pipeline-schema'
import { logger } from '@/lib/shared/logger'
import { toActionResult, type ActionResult } from './_result'
import type { JobRunDto } from '@/lib/runs/run-schema'

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
