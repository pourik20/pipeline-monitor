import { datasetService } from "@/lib/datasets/dataset-service";
import { NewPipelineForm } from "./new-pipeline-form";

export const dynamic = "force-dynamic";

export default async function NewPipelinePage() {
  const datasets = await datasetService.list();
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New pipeline</h1>
      <NewPipelineForm
        datasets={datasets.map((d) => ({ id: d.id, name: d.name }))}
      />
    </main>
  );
}
