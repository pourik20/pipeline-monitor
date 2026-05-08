import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { pipelineVersionService } from "@/lib/pipelines/pipeline-version-service";
import { logger } from "@/lib/shared/logger";

type Ctx = { params: Promise<{ id: string; versionId: string }> };

export const PATCH = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id, versionId } = await params;
  const version = await pipelineVersionService.activate(id, versionId);
  logger.info(
    { pipelineId: id, versionId, version: version.version },
    "pipeline version activated",
  );
  return Response.json(version);
});
