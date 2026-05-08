import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { datasetService } from "@/lib/datasets/dataset-service";
import { logger } from "@/lib/shared/logger";

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
