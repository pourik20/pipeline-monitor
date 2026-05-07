import { withErrorHandling } from "@/lib/with-error-handling";
import { alertRepository } from "@/lib/repositories/alert-repository";
import { NotFoundError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rule = await alertRepository.findRuleById(id);
  if (!rule) throw new NotFoundError("Alert rule not found");
  return Response.json({
    id: String(rule._id),
    pipelineId: String(rule.pipelineId),
    name: rule.name,
    condition: rule.condition,
    enabled: rule.enabled,
    createdBy: rule.createdBy,
    createdAt: rule.createdAt?.toISOString() ?? null,
    updatedAt: (rule as typeof rule & { updatedAt?: Date }).updatedAt?.toISOString() ?? null,
  });
});
