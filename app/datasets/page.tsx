import Link from "next/link";
import { datasetService } from "@/lib/datasets/dataset-service";
import { Button } from "@/components/ui/button";
import { DatasetsTable } from "./datasets-table";

export const dynamic = "force-dynamic";

export default async function DatasetsPage() {
  const datasets = await datasetService.list();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        <Button asChild>
          <Link href="/datasets/new">New dataset</Link>
        </Button>
      </div>

      <DatasetsTable
        datasets={datasets.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          createdAt: d.createdAt,
        }))}
      />
    </main>
  );
}
