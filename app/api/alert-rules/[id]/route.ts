import { withErrorHandling } from "@/lib/with-error-handling";
import { alertRuleService } from "@/lib/services/alert-rule-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rule = await alertRuleService.getById(id);
  return Response.json(rule);
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json()) as { enabled?: boolean };
  const result = await alertRuleService.setEnabled(id, !!body.enabled);
  return Response.json(result);
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await alertRuleService.deleteById(id);
  return new Response(null, { status: 204 });
});
