import Link from "next/link";
import { runService } from "@/lib/services/run-service";
import { pipelineService } from "@/lib/services/pipeline-service";
import { runListQuerySchema } from "@/lib/schemas/run";
import { RunFilters } from "./run-filters";
import { ClickableRow } from "@/components/clickable-row";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function flatten(params: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

function buildHref(base: Record<string, string>, overrides: Record<string, string | null>) {
  const next = new URLSearchParams(base);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `/runs?${qs}` : "/runs";
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = flatten(await searchParams);
  const parsed = runListQuerySchema.safeParse(raw);
  const query = parsed.success
    ? parsed.data
    : runListQuerySchema.parse({});

  const [{ items, nextCursor }, pipelines] = await Promise.all([
    runService.list(query),
    pipelineService.list(),
  ]);

  const baseParams: Record<string, string> = {};
  if (query.pipelineId) baseParams.pipelineId = query.pipelineId;
  if (query.status) baseParams.status = query.status;
  if (query.from) baseParams.from = query.from;
  if (query.to) baseParams.to = query.to;
  if (query.limit !== 50) baseParams.limit = String(query.limit);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Runs</h1>

      <RunFilters
        pipelineOptions={pipelines.map((p) => ({ id: p.id, name: p.name }))}
      />

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No runs match the filters.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="py-2 pr-4 font-medium">Run</th>
              <th className="py-2 pr-4 font-medium">Pipeline</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Started</th>
              <th className="py-2 pr-4 font-medium">Finished</th>
              <th className="py-2 pr-4 font-medium">Records</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <ClickableRow
                key={r.id}
                href={`/runs/${r.id}`}
                className="border-b last:border-0 hover:bg-muted/50"
              >
                <td className="py-2 pr-4 font-mono text-xs">
                  {r.id.slice(-8)}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-zinc-500">
                  {r.pipelineId.slice(-8)}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={
                      r.status === "running"
                        ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : r.status === "success"
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : r.status === "failed"
                            ? "rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-zinc-500">
                  {r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4 text-zinc-500">
                  {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4">{r.recordsProcessed}</td>
              </ClickableRow>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-6 flex items-center justify-end gap-3 text-sm">
        {nextCursor && (
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(baseParams, { cursor: nextCursor })}>
              Next page →
            </Link>
          </Button>
        )}
      </div>
    </main>
  );
}
