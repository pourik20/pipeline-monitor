import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { pipelineService } from "@/lib/pipelines/pipeline-service";
import { logger } from "@/lib/shared/logger";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const pipeline = await pipelineService.getById(id);
  logger.info({ pipelineId: pipeline.id }, "pipeline fetched");
  return Response.json(pipeline);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await pipelineService.deleteById(id);
  return new Response(null, { status: 204 });
});
