import 'server-only'
import { normalizeError } from '@/lib/shared/errors-to-result'
import type { ErrorCode } from '@/lib/shared/errors'

export interface ActionError {
  code: ErrorCode | 'internal'
  message: string
  details?: unknown
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError }

export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err) {
    const { status: _status, ...error } = normalizeError(err)
    return { ok: false, error }
  }
}
