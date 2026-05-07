'use server'

import { revalidatePath } from 'next/cache'
import { runService } from '../services/run-service'
import { pipelineRunner } from '../services/pipeline-runner'
import { patchRunBodySchema } from '../schemas/run'
import { logger } from '../logger'
import { toActionResult, type ActionResult } from './_result'
import type { JobRunDto } from '../schemas/run'

export async function terminateRun(
  id: string,
  body: { status: 'success' | 'failed'; errorMessage?: string },
): Promise<ActionResult<{ id: string; status: 'success' | 'failed' | 'running' }>> {
  return toActionResult(async () => {
    const parsed = patchRunBodySchema.parse(body)
    const result = await runService.terminate(id, parsed)
    logger.info({ runId: id, status: parsed.status }, 'run terminated (action)')
    revalidatePath(`/runs/${id}`)
    revalidatePath('/runs')
    return result
  })
}

export async function retryRun(
  pipelineId: string,
): Promise<ActionResult<JobRunDto>> {
  return toActionResult(async () => {
    const run = await pipelineRunner.start(pipelineId)
    logger.info({ pipelineId, runId: run.id }, 'pipeline run retried (action)')
    revalidatePath('/runs')
    revalidatePath(`/pipelines/${pipelineId}`)
    return run
  })
}
