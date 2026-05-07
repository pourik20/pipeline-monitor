import Link from "next/link";
import { pipelineService } from "@/lib/services/pipeline-service";
import { datasetService } from "@/lib/services/dataset-service";

export const dynamic = "force-dynamic";

export default async function PipelinesPage() {
  const [pipelines, datasets] = await Promise.all([
    pipelineService.list(),
    datasetService.list(),
  ]);
  const datasetById = new Map(datasets.map((d) => [d.id, d]));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
        <Link
          href="/pipelines/new"
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          New pipeline
        </Link>
      </div>

      {pipelines.length === 0 ? (
        <p className="text-sm text-zinc-500">No pipelines yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Dataset</th>
              <th className="py-2 pr-4 font-medium">Schedule</th>
              <th className="py-2 pr-4 font-medium">Active</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pipelines.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{p.name}</td>
                <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                  {datasetById.get(p.datasetId)?.name ?? p.datasetId}
                </td>
                <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                  {p.schedule || "—"}
                </td>
                <td className="py-2 pr-4">
                  {p.active ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      inactive
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  <Link
                    href={`/pipelines/${p.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
