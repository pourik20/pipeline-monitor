import { z } from "zod";

export const createDatasetSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(2000).optional().default(""),
});

export type CreateDatasetInput = z.infer<typeof createDatasetSchema>;

export const datasetDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  owner: z.string(),
  createdBy: z.string(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DatasetDto = z.infer<typeof datasetDtoSchema>;
