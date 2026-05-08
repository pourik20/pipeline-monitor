'use server'

import { revalidatePath } from 'next/cache'
import { authContext } from '@/lib/shared/auth-context'
import { pipelineVersionService } from '@/lib/pipelines/pipeline-version-service'
import {
  createPipelineVersionSchema,
  type CreatePipelineVersionInput,
  type PipelineVersionDto,
} from '@/lib/pipelines/pipeline-schema'
import { logger } from '@/lib/shared/logger'
import { toActionResult, type ActionResult } from './_result'

export async function createPipelineVersion(
  pipelineId: string,
  input: CreatePipelineVersionInput,
): Promise<ActionResult<PipelineVersionDto>> {
  return toActionResult(async () => {
    const parsed = createPipelineVersionSchema.parse(input)
    const user = await authContext.currentUser()
    const version = await pipelineVersionService.create(pipelineId, parsed, user)
    logger.info(
      { pipelineId, versionId: version.id, version: version.version },
      'pipeline version created (action)',
    )
    revalidatePath(`/pipelines/${pipelineId}`)
    return version
  })
}

export async function activatePipelineVersion(
  pipelineId: string,
  versionId: string,
): Promise<ActionResult<PipelineVersionDto>> {
  return toActionResult(async () => {
    const version = await pipelineVersionService.activate(pipelineId, versionId)
    logger.info(
      { pipelineId, versionId, version: version.version },
      'pipeline version activated (action)',
    )
    revalidatePath(`/pipelines/${pipelineId}`)
    return version
  })
}
