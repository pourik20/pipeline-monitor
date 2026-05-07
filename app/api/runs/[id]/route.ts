import { withErrorHandling } from '@/lib/with-error-handling'
import { runService } from '@/lib/services/run-service'
import { patchRunBodySchema } from '@/lib/schemas/run'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params
  const detail = await runService.getById(id)
  return Response.json(detail)
})

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params
  const body = patchRunBodySchema.parse(await req.json())
  const result = await runService.terminate(id, body)
  return Response.json(result)
})
