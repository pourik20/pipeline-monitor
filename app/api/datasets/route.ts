import { withErrorHandling } from "@/lib/with-error-handling";
import { authContext } from "@/lib/auth-context";
import { datasetService } from "@/lib/services/dataset-service";
import { logger } from "@/lib/logger";
import { createDatasetSchema } from "@/lib/schemas/dataset";

export const POST = withErrorHandling(async (req: Request) => {
  const json = await req.json().catch(() => ({}));
  const input = createDatasetSchema.parse(json);
  const user = await authContext.currentUser();
  const dataset = await datasetService.create(input, user);
  logger.info({ datasetId: dataset.id, name: dataset.name }, "dataset created");
  return Response.json(dataset, { status: 201 });
});

export const GET = withErrorHandling(async () => {
  const datasets = await datasetService.list();
  logger.info({ count: datasets.length }, "datasets listed");
  return Response.json(datasets);
});
