import Link from "next/link";
import { notFound } from "next/navigation";
import { runService } from "@/lib/services/pipeline-runner";
import { NotFoundError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function RunDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  let detail;
  try {
    detail = await runService.getById(id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { run, steps } = detail;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6">
        <Link href="/runs" className="text-sm text-zinc-500 hover:underline">
          ← Runs
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-semibold tracking-tight">
        Run <span className="font-mono text-base">{run.id.slice(-8)}</span>
      </h1>

      <dl className="mt-4 mb-8 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500">Status</dt>
        <dd>{run.status}</dd>
        <dt className="text-zinc-500">Pipeline</dt>
        <dd className="font-mono text-xs">
          <Link href={`/pipelines/${run.pipelineId}`} className="hover:underline">
            {run.pipelineId}
          </Link>
        </dd>
        <dt className="text-zinc-500">Pipeline version</dt>
        <dd className="font-mono text-xs">{run.pipelineVersionId}</dd>
        <dt className="text-zinc-500">Started</dt>
        <dd>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</dd>
        <dt className="text-zinc-500">Finished</dt>
        <dd>{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"}</dd>
        <dt className="text-zinc-500">Records processed</dt>
        <dd>{run.recordsProcessed}</dd>
        {run.errorMessage && (
          <>
            <dt className="text-zinc-500">Error</dt>
            <dd className="text-red-600">{run.errorMessage}</dd>
          </>
        )}
        <dt className="text-zinc-500">Plan</dt>
        <dd>
          willFail={String(run.plan.willFail)}
          {run.plan.failAtStepIndex !== null &&
            `, failAtStepIndex=${run.plan.failAtStepIndex}`}
        </dd>
      </dl>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Steps</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-zinc-500">No steps.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Planned duration</th>
                <th className="py-2 pr-4 font-medium">Records target</th>
                <th className="py-2 pr-4 font-medium">Records processed</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => {
                const planStep = run.plan.steps.find((p) => p.order === s.order);
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{s.order}</td>
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className="py-2 pr-4">{s.status}</td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {planStep ? `${planStep.durationMs} ms` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {planStep?.recordsTarget ?? "—"}
                    </td>
                    <td className="py-2 pr-4">{s.recordsProcessed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
