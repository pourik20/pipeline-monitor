import { withErrorHandling } from "@/lib/with-error-handling";
import { authContext } from "@/lib/auth-context";
import { alertRuleService } from "@/lib/services/alert-rule-service";
import { createAlertRuleSchema } from "@/lib/schemas/alert-rule";
import { logger } from "@/lib/logger";

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const input = createAlertRuleSchema.parse(json);
  const user = await authContext.currentUser();
  const rule = await alertRuleService.create(input, user);
  logger.info({ ruleId: rule.id, pipelineId: rule.pipelineId }, "alert rule created");
  return Response.json(rule, { status: 201 });
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId") ?? "";
  const rules = await alertRuleService.listByPipeline(pipelineId);
  return Response.json(rules);
});
