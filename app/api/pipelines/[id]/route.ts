import { withErrorHandling } from "@/lib/with-error-handling";
import { pipelineService } from "@/lib/services/pipeline-service";
import { logger } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const pipeline = await pipelineService.getById(id);
  logger.info({ pipelineId: pipeline.id }, "pipeline fetched");
  return Response.json(pipeline);
});
