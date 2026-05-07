import Link from "next/link";
import { notFound } from "next/navigation";
import { pipelineService } from "@/lib/services/pipeline-service";
import { pipelineVersionService } from "@/lib/services/pipeline-version-service";
import { datasetService } from "@/lib/services/dataset-service";
import { NotFoundError } from "@/lib/errors";
import { ActivateVersionButton } from "./activate-version-button";
import { NewVersionForm } from "./new-version-form";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  let pipeline;
  try {
    pipeline = await pipelineService.getById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [versions, dataset] = await Promise.all([
    pipelineVersionService.list(id),
    datasetService.getById(pipeline.datasetId).catch(() => null),
  ]);
  const active = versions.find((v) => v.active) ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link
          href="/pipelines"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Pipelines
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{pipeline.name}</h1>
        {pipeline.description && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {pipeline.description}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-zinc-500">Dataset</dt>
          <dd>{dataset?.name ?? pipeline.datasetId}</dd>
          <dt className="text-zinc-500">Schedule</dt>
          <dd>{pipeline.schedule || "—"}</dd>
          <dt className="text-zinc-500">Active</dt>
          <dd>{pipeline.active ? "yes" : "no"}</dd>
          <dt className="text-zinc-500">Created</dt>
          <dd>{new Date(pipeline.createdAt).toLocaleString()}</dd>
        </dl>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Active version</h2>
        {active ? (
          <div className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            <div className="mb-2 flex items-center gap-3">
              <span className="font-medium">v{active.version}</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                active
              </span>
            </div>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              <dt className="text-zinc-500">Engine</dt>
              <dd>{active.config.engine}</dd>
              <dt className="text-zinc-500">Query</dt>
              <dd>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                  {active.config.query || "—"}
                </pre>
              </dd>
              <dt className="text-zinc-500">Failure rate</dt>
              <dd>{active.config.simulation.failureRate}</dd>
              <dt className="text-zinc-500">Steps</dt>
              <dd>
                <ul className="list-disc pl-5">
                  {active.config.simulation.steps.map((s, i) => (
                    <li key={i}>
                      {s.name} — {s.minDurationMs}-{s.maxDurationMs} ms,{" "}
                      {s.recordsTarget} records
                    </li>
                  ))}
                </ul>
              </dd>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No active version yet.</p>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Versions</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-zinc-500">No versions yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Engine</th>
                <th className="py-2 pr-4 font-medium">Created</th>
                <th className="py-2 pr-4 font-medium">Active</th>
                <th className="py-2 pr-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">v{v.version}</td>
                  <td className="py-2 pr-4">{v.config.engine}</td>
                  <td className="py-2 pr-4 text-zinc-500">
                    {new Date(v.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4">
                    {v.active ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        active
                      </span>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {!v.active && (
                      <ActivateVersionButton
                        pipelineId={pipeline.id}
                        versionId={v.id}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Create new version</h2>
        <NewVersionForm pipelineId={pipeline.id} />
      </section>
    </main>
  );
}
