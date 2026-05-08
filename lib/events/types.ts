import type mongoose from 'mongoose'

export interface RunStepSnapshot {
  name: string
  order: number
  status: string
  recordsProcessed: number
}

export interface RunFinalizedEvent {
  type: 'runFinalized'
  runId: mongoose.Types.ObjectId
  pipelineId: mongoose.Types.ObjectId
  pipelineVersionId: mongoose.Types.ObjectId
  status: 'success' | 'failed'
  startedAt: Date | null
  finishedAt: Date
  recordsProcessed: number
  errorMessage: string | null
}

export interface RunProgressedEvent {
  type: 'runProgressed'
  runId: mongoose.Types.ObjectId
  pipelineId: mongoose.Types.ObjectId
  pipelineVersionId: mongoose.Types.ObjectId
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt: Date | null
  finishedAt: Date | null
  recordsProcessed: number
  errorMessage: string | null
  steps: RunStepSnapshot[]
}

export interface AlertFiredEvent {
  type: 'alertFired'
  runId: mongoose.Types.ObjectId
  ruleId: mongoose.Types.ObjectId
  ruleName: string
  message: string
}

export type DomainEvent = RunFinalizedEvent | RunProgressedEvent | AlertFiredEvent
export type EventType = DomainEvent['type']
export type EventOf<T extends EventType> = Extract<DomainEvent, { type: T }>
