import { withErrorHandling } from "@/lib/shared/with-error-handling";
import { authContext } from "@/lib/shared/auth-context";
import { datasetService } from "@/lib/datasets/dataset-service";
import { logger } from "@/lib/shared/logger";
import { createDatasetSchema } from "@/lib/datasets/dataset-schema";

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
