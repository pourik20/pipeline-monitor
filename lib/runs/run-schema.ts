import { z } from "zod";
import { JOB_RUN_STATUSES } from "@/lib/runs/job-run-model";

export const runStatusSchema = z.enum(JOB_RUN_STATUSES);

export const runListQuerySchema = z.object({
  pipelineId: z.string().optional(),
  status: runStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
export type RunListQuery = z.infer<typeof runListQuerySchema>;

export const planStepDtoSchema = z.object({
  name: z.string(),
  order: z.number(),
  durationMs: z.number(),
  recordsTarget: z.number(),
});

export const planDtoSchema = z.object({
  steps: z.array(planStepDtoSchema),
  willFail: z.boolean(),
  failAtStepIndex: z.number().nullable(),
});

export const jobRunDtoSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  pipelineVersionId: z.string(),
  status: runStatusSchema,
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  recordsProcessed: z.number(),
  errorMessage: z.string().nullable(),
  plan: planDtoSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type JobRunDto = z.infer<typeof jobRunDtoSchema>;

export const runListItemDtoSchema = jobRunDtoSchema;
export type RunListItemDto = JobRunDto;

export const runListResponseSchema = z.object({
  items: z.array(runListItemDtoSchema),
  nextCursor: z.string().nullable(),
});

export const materializedStepStateSchema = z.object({
  order: z.number(),
  name: z.string(),
  status: z.enum(["pending", "running", "success", "failed"]),
  recordsProcessed: z.number(),
  progress: z.number(),
});
export type MaterializedStepStateDto = z.infer<typeof materializedStepStateSchema>;

export const materializedSnapshotSchema = z.object({
  runId: z.string(),
  status: runStatusSchema,
  currentStepIndex: z.number().nullable(),
  currentStepProgress: z.number(),
  recordsProcessed: z.number(),
  steps: z.array(materializedStepStateSchema),
  finishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});
export type MaterializedSnapshotDto = z.infer<typeof materializedSnapshotSchema>;

export const runDetailWithSnapshotSchema = z.object({
  run: jobRunDtoSchema,
  snapshot: materializedSnapshotSchema,
});
export type RunDetailWithSnapshot = z.infer<typeof runDetailWithSnapshotSchema>;

export const patchRunBodySchema = z.object({
  status: z.enum(["success", "failed"]),
  errorMessage: z.string().optional(),
});
