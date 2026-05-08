'use server'

import { revalidatePath } from 'next/cache'
import { authContext } from '@/lib/shared/auth-context'
import { datasetService } from '@/lib/datasets/dataset-service'
import { createDatasetSchema, type CreateDatasetInput } from '@/lib/datasets/dataset-schema'
import { logger } from '@/lib/shared/logger'
import { toActionResult, type ActionResult } from './_result'

export async function createDataset(
  input: CreateDatasetInput,
): Promise<ActionResult<Awaited<ReturnType<typeof datasetService.create>>>> {
  return toActionResult(async () => {
    const parsed = createDatasetSchema.parse(input)
    const user = await authContext.currentUser()
    const dataset = await datasetService.create(parsed, user)
    logger.info({ datasetId: dataset.id, name: dataset.name }, 'dataset created (action)')
    revalidatePath('/datasets')
    return dataset
  })
}

export async function deleteDataset(id: string): Promise<ActionResult<{ id: string }>> {
  return toActionResult(async () => {
    await datasetService.deleteById(id)
    revalidatePath('/datasets')
    return { id }
  })
}
