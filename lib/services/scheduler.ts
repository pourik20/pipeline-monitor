// Stub interface for production cron-based pipeline scheduling. Not invoked in slice 3.
export interface Scheduler {
  schedule(pipelineId: string, cronExpression: string): Promise<void>;
  unschedule(pipelineId: string): Promise<void>;
}
