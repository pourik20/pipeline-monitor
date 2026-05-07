import mongoose from "mongoose";
import { withErrorHandling } from "@/lib/with-error-handling";
import { authContext } from "@/lib/auth-context";
import { alertRepository } from "@/lib/repositories/alert-repository";
import { createAlertRuleSchema } from "@/lib/schemas/alert-rule";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import jsonata from "jsonata";

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const input = createAlertRuleSchema.parse(json);

  if (!mongoose.isValidObjectId(input.pipelineId)) {
    throw new ValidationError("Invalid pipelineId");
  }

  try {
    jsonata(input.condition);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSONata expression";
    throw new ValidationError("Invalid JSONata condition", message);
  }

  const user = await authContext.currentUser();
  const rule = await alertRepository.createRule({
    pipelineId: new mongoose.Types.ObjectId(input.pipelineId),
    name: input.name,
    condition: input.condition,
    enabled: input.enabled,
    createdBy: user.id,
  });

  logger.info({ ruleId: rule._id, pipelineId: input.pipelineId }, "alert rule created");
  return Response.json(toDto(rule), { status: 201 });
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId") ?? "";
  const rules = await alertRepository.findRulesByPipelineId(pipelineId);
  return Response.json(rules.map(toDto));
});

function toDto(rule: Awaited<ReturnType<typeof alertRepository.createRule>>) {
  return {
    id: String(rule._id),
    pipelineId: String(rule.pipelineId),
    name: rule.name,
    condition: rule.condition,
    enabled: rule.enabled,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt?.toISOString() ?? null,
    updatedAt: (rule as typeof rule & { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
  };
}
