import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { alertRepository } from "@/lib/alerts/alert-repository";
import { alertListQuerySchema } from "@/lib/alerts/alert-rule-schema";

export const GET = withErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const query = alertListQuerySchema.parse(raw);
  const { items, nextCursor } = await alertRepository.findAlerts(query);
  return Response.json({
    items: items.map((e) => ({
      id: String(e._id),
      ruleId: String(e.ruleId),
      runId: String(e.runId),
      message: e.message,
      createdAt: e.createdAt?.toISOString() ?? null,
    })),
    nextCursor,
  });
});
