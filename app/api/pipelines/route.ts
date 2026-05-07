import { withErrorHandling } from "@/lib/with-error-handling";
import { authContext } from "@/lib/auth-context";
import { pipelineService } from "@/lib/services/pipeline-service";
import { logger } from "@/lib/logger";
import { createPipelineSchema } from "@/lib/schemas/pipeline";

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const input = createPipelineSchema.parse(json);
  const user = await authContext.currentUser();
  const pipeline = await pipelineService.create(input, user);
  logger.info({ pipelineId: pipeline.id, name: pipeline.name }, "pipeline created");
  return Response.json(pipeline, { status: 201 });
});

export const GET = withErrorHandling(async () => {
  const pipelines = await pipelineService.list();
  logger.info({ count: pipelines.length }, "pipelines listed");
  return Response.json(pipelines);
});
