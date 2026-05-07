import { z } from "zod";

export const createPipelineSchema = z.object({
  datasetId: z.string().min(1),
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(2000).optional().default(""),
  schedule: z.string().max(120).optional().default(""),
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;

export const simulationStepSchema = z
  .object({
    name: z.string().min(1).max(80),
    minDurationMs: z.number().int().nonnegative(),
    maxDurationMs: z.number().int().nonnegative(),
    recordsTarget: z.number().int().nonnegative(),
  })
  .refine((s) => s.maxDurationMs >= s.minDurationMs, {
    message: "maxDurationMs must be >= minDurationMs",
    path: ["maxDurationMs"],
  });

export const createPipelineVersionSchema = z.object({
  config: z.object({
    engine: z.string().min(1),
    query: z.string().default(""),
    simulation: z.object({
      steps: z.array(simulationStepSchema).min(1),
      failureRate: z.number().min(0).max(1).default(0),
    }),
  }),
});

export type CreatePipelineVersionInput = z.infer<typeof createPipelineVersionSchema>;

export const pipelineDtoSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  name: z.string(),
  description: z.string(),
  schedule: z.string(),
  active: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PipelineDto = z.infer<typeof pipelineDtoSchema>;

export const pipelineVersionDtoSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  version: z.number(),
  active: z.boolean(),
  config: z.object({
    engine: z.string(),
    query: z.string(),
    simulation: z.object({
      steps: z.array(
        z.object({
          name: z.string(),
          minDurationMs: z.number(),
          maxDurationMs: z.number(),
          recordsTarget: z.number(),
        }),
      ),
      failureRate: z.number(),
    }),
  }),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PipelineVersionDto = z.infer<typeof pipelineVersionDtoSchema>;
