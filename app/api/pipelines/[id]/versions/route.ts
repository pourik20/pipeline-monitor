import { withErrorHandling } from "@/lib/with-error-handling";
import { authContext } from "@/lib/auth-context";
import { pipelineVersionService } from "@/lib/services/pipeline-version-service";
import { logger } from "@/lib/logger";
import { createPipelineVersionSchema } from "@/lib/schemas/pipeline";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const input = createPipelineVersionSchema.parse(json);
  const user = await authContext.currentUser();
  const version = await pipelineVersionService.create(id, input, user);
  logger.info(
    { pipelineId: id, versionId: version.id, version: version.version },
    "pipeline version created",
  );
  return Response.json(version, { status: 201 });
});

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const versions = await pipelineVersionService.list(id);
  return Response.json(versions);
});
