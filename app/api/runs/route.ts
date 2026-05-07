import { withErrorHandling } from "@/lib/with-error-handling";
import { runService } from "@/lib/services/pipeline-runner";
import { runListQuerySchema } from "@/lib/schemas/run";

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const query = runListQuerySchema.parse(raw);
  const { items, nextCursor } = await runService.list(query);
  return Response.json({ items, nextCursor });
});
