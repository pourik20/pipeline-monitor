import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { alertRules } from "@/lib/alerts/rules";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rule = await alertRules.getById(id);
  return Response.json(rule);
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json()) as { enabled?: boolean };
  const result = await alertRules.setEnabled(id, !!body.enabled);
  return Response.json(result);
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  await alertRules.deleteById(id);
  return new Response(null, { status: 204 });
});
