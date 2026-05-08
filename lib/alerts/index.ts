import 'server-only'
import { logger } from '@/lib/shared/logger'
import { systemClock } from '@/lib/shared/clock'
import { bus } from '@/lib/events'
import type { RunFinalizedEvent, RunProgressedEvent } from '@/lib/events'
import { evaluator, type AlertRunInput } from './evaluator'
import { recorder } from './recorder'
import { alertRepository } from './alert-repository'

export { alertRules } from './rules'
export type { AlertRuleDto, CreateAlertRuleInput } from './alert-rule-schema'

async function evaluateAndRecord(input: AlertRunInput): Promise<void> {
  try {
    const rules = await alertRepository.findEnabledRulesByPipelineId(input.pipelineId)
    if (rules.length === 0) return
    const matches = await evaluator.evaluate(rules, input, systemClock.now())
    if (matches.length === 0) return
    await recorder.record(matches, { _id: input._id, status: input.status })
  } catch (err) {
    logger.error({ err, runId: input._id }, 'alert evaluation failed; ignoring')
  }
}

function fromFinalized(e: RunFinalizedEvent): AlertRunInput {
  return {
    _id: e.runId,
    pipelineId: e.pipelineId,
    pipelineVersionId: e.pipelineVersionId,
    status: e.status,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    recordsProcessed: e.recordsProcessed,
    errorMessage: e.errorMessage,
  }
}

function fromProgressed(e: RunProgressedEvent): AlertRunInput {
  return {
    _id: e.runId,
    pipelineId: e.pipelineId,
    pipelineVersionId: e.pipelineVersionId,
    status: e.status,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    recordsProcessed: e.recordsProcessed,
    errorMessage: e.errorMessage,
    steps: e.steps,
  }
}

declare global {
  var __alertSubscribed: boolean | undefined
}

if (!globalThis.__alertSubscribed) {
  bus.on('runFinalized', (e) => evaluateAndRecord(fromFinalized(e)))
  bus.on('runProgressed', (e) => evaluateAndRecord(fromProgressed(e)))
  globalThis.__alertSubscribed = true
}
