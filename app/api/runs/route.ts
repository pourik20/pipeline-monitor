import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { runService } from "@/lib/runs/run-service";
import { runListQuerySchema } from "@/lib/runs/run-schema";

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const query = runListQuerySchema.parse(raw);
  const { items, nextCursor } = await runService.list(query);
  return Response.json({ items, nextCursor });
});
