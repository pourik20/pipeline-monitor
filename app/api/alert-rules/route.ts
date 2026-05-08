import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { authContext } from "@/lib/shared/auth-context";
import { alertRules } from "@/lib/alerts/rules";
import { createAlertRuleSchema } from "@/lib/alerts/alert-rule-schema";
import { logger } from "@/lib/shared/logger";

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const input = createAlertRuleSchema.parse(json);
  const user = await authContext.currentUser();
  const rule = await alertRules.create(input, user);
  logger.info({ ruleId: rule.id, pipelineId: rule.pipelineId }, "alert rule created");
  return Response.json(rule, { status: 201 });
});

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const pipelineId = url.searchParams.get("pipelineId") ?? "";
  const rules = await alertRules.listByPipeline(pipelineId);
  return Response.json(rules);
});
