import { withErrorHandling } from "@/lib/with-error-handling";
import { pipelineRunner } from "@/lib/services/pipeline-runner";
import { logger } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const run = await pipelineRunner.start(id);
  logger.info({ pipelineId: id, runId: run.id }, "pipeline run started");
  return Response.json(run, { status: 201 });
});
