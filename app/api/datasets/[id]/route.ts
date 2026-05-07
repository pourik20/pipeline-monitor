import { withErrorHandling } from "@/lib/with-error-handling";
import { datasetService } from "@/lib/services/dataset-service";
import { logger } from "@/lib/logger";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const dataset = await datasetService.getById(id);
  logger.info({ datasetId: dataset.id }, "dataset fetched");
  return Response.json(dataset);
});

export const DELETE = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await datasetService.deleteById(id);
  return new Response(null, { status: 204 });
});
