import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { alertRepository } from "@/lib/alerts/alert-repository";
import { NotFoundError } from "@/lib/shared/errors";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const event = await alertRepository.findAlertById(id);
  if (!event) throw new NotFoundError("Alert event not found");
  return Response.json({
    id: String(event._id),
    ruleId: String(event.ruleId),
    runId: String(event.runId),
    message: event.message,
    createdAt: event.createdAt?.toISOString() ?? null,
  });
});
