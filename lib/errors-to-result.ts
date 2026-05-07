import { ZodError, type ZodIssue } from 'zod'
import { DomainError, type ErrorCode } from './errors'
import { logger } from './logger'

export interface NormalizedError {
  code: ErrorCode | 'internal'
  status: number
  message: string
  details?: unknown
}

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof ZodError) {
    logger.info({ err: err.issues }, 'validation failed')
    return {
      code: 'validation',
      status: 400,
      message: 'Invalid input',
      details: err.issues as ZodIssue[],
    }
  }
  if (err instanceof DomainError) {
    logger.info(
      { code: err.code, status: err.status, message: err.message },
      'domain error',
    )
    return {
      code: err.code,
      status: err.status,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    }
  }
  logger.error({ err }, 'unhandled error')
  return {
    code: 'internal',
    status: 500,
    message: 'Internal server error',
  }
}
