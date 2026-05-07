import { withErrorHandling } from "@/lib/with-error-handling";
import { runService } from "@/lib/services/pipeline-runner";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const detail = await runService.getById(id);
  return Response.json(detail);
});
