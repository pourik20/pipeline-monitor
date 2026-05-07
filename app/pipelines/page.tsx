import { pipelineService } from "@/lib/services/pipeline-service";
import { datasetService } from "@/lib/services/dataset-service";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClickableRow } from "@/components/clickable-row";
import { RunNowButton } from "@/app/pipelines/[id]/run-now-button";

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
        <Button asChild>
          <Link href="/pipelines/new">New pipeline</Link>
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pipelines yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Dataset</th>
              <th className="py-2 pr-4 font-medium">Schedule</th>
              <th className="py-2 pr-4 font-medium">Active</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pipelines.map((p) => (
              <ClickableRow
                key={p.id}
                href={`/pipelines/${p.id}`}
                className="border-b last:border-0 hover:bg-muted/50"
              >
                <td className="py-2 pr-4 font-medium">{p.name}</td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {datasetById.get(p.datasetId)?.name ?? p.datasetId}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {p.schedule || "—"}
                </td>
                <td className="py-2 pr-4">
                  {p.active ? (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      inactive
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  <RunNowButton pipelineId={p.id} />
                </td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
