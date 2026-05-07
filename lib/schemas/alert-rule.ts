import { z } from "zod";

export const createAlertRuleSchema = z.object({
  pipelineId: z.string().min(1),
  name: z.string().min(1).max(200),
  condition: z.string().min(1),
  enabled: z.boolean().default(true),
});
export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;

export const alertListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
