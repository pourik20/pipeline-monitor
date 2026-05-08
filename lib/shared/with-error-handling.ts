import { normalizeError } from '@/lib/shared/errors-to-result'

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response> | Response

export function withErrorHandling<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const normalized = normalizeError(err)
      const { status, ...payload } = normalized
      return Response.json({ error: payload }, { status })
    }
  }
}
