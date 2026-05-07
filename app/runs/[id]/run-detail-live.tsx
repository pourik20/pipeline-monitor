"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { JobRunDto, MaterializedSnapshotDto } from "@/lib/schemas/run";

interface Props {
  run: JobRunDto;
  initialSnapshot: MaterializedSnapshotDto;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-zinc-500",
  running: "text-blue-600",
  success: "text-green-600",
  failed: "text-red-600",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-zinc-200">
      <div
        className="h-1.5 rounded-full bg-blue-500 transition-all"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function RunDetailLive({ run, initialSnapshot }: Props) {
  const [snapshot, setSnapshot] = useState<MaterializedSnapshotDto>(initialSnapshot);
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const prevStatusRef = useRef<string>(initialSnapshot.status);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const newStatus = snapshot.status;

    if (prevStatus === "running" && newStatus === "success") {
      toast.success("Run completed successfully", {
        description: `${snapshot.recordsProcessed.toLocaleString()} records processed`,
      });
    } else if (prevStatus === "running" && newStatus === "failed") {
      toast.error("Run failed", {
        description: snapshot.errorMessage ?? "An unexpected error occurred",
      });
    }

    prevStatusRef.current = newStatus;
  }, [snapshot]);

  useEffect(() => {
    const es = new EventSource(`/api/runs/${run.id}/stream`);
    es.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as MaterializedSnapshotDto;
      setSnapshot(data);
    };
    es.addEventListener("alerts", (e: MessageEvent) => {
      const names = JSON.parse(e.data as string) as string[];
      names.forEach((name) =>
        toast.warning(`Alert fired: ${name}`, {
          description: "Condition matched on run completion",
        }),
      );
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, [run.id]);

  const handleTerminate = async () => {
    setIsTerminating(true);
    setTerminateError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "failed", errorMessage: "Manually terminated" }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? "Termination failed");
      }
      setSnapshot((prev) => ({
        ...prev,
        status: "failed",
        currentStepIndex: null,
        currentStepProgress: 0,
        errorMessage: "Manually terminated",
      }));
    } catch (err) {
      setTerminateError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsTerminating(false);
    }
  };

  const isRunning = snapshot.status === "running";

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <a href="/runs" className="text-sm text-zinc-500 hover:underline">
          ← Runs
        </a>
        {isRunning && (
          <button
            onClick={handleTerminate}
            disabled={isTerminating}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {isTerminating ? "Terminating…" : "Terminate"}
          </button>
        )}
      </div>

      {terminateError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {terminateError}
        </p>
      )}

      <h1 className="mb-2 text-2xl font-semibold tracking-tight">
        Run <span className="font-mono text-base">{run.id.slice(-8)}</span>
      </h1>

      {isRunning && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <span className="text-sm text-blue-600">Live</span>
        </div>
      )}

      <dl className="mt-4 mb-8 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-zinc-500">Status</dt>
        <dd className={STATUS_COLORS[snapshot.status] ?? ""}>{snapshot.status}</dd>
        <dt className="text-zinc-500">Pipeline</dt>
        <dd className="font-mono text-xs">
          <a href={`/pipelines/${run.pipelineId}`} className="hover:underline">
            {run.pipelineId}
          </a>
        </dd>
        <dt className="text-zinc-500">Pipeline version</dt>
        <dd className="font-mono text-xs">{run.pipelineVersionId}</dd>
        <dt className="text-zinc-500">Started</dt>
        <dd>{run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</dd>
        <dt className="text-zinc-500">Finished</dt>
        <dd>{snapshot.finishedAt ? new Date(snapshot.finishedAt).toLocaleString() : "—"}</dd>
        <dt className="text-zinc-500">Records processed</dt>
        <dd>{snapshot.recordsProcessed.toLocaleString()}</dd>
        {snapshot.errorMessage && (
          <>
            <dt className="text-zinc-500">Error</dt>
            <dd className="text-red-600">{snapshot.errorMessage}</dd>
          </>
        )}
        <dt className="text-zinc-500">Plan</dt>
        <dd>
          willFail={String(run.plan.willFail)}
          {run.plan.failAtStepIndex !== null && `, failAtStepIndex=${run.plan.failAtStepIndex}`}
        </dd>
      </dl>

      {isRunning && snapshot.currentStepIndex !== null && (
        <div className="mb-6">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Step {snapshot.currentStepIndex + 1} progress</span>
            <span>{Math.round(snapshot.currentStepProgress * 100)}%</span>
          </div>
          <ProgressBar value={snapshot.currentStepProgress} />
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Steps</h2>
        {snapshot.steps.length === 0 ? (
          <p className="text-sm text-zinc-500">No steps.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Progress</th>
                <th className="py-2 pr-4 font-medium">Planned duration</th>
                <th className="py-2 pr-4 font-medium">Records target</th>
                <th className="py-2 pr-4 font-medium">Records processed</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.steps.map((s) => {
                const planStep = run.plan.steps.find((p) => p.order === s.order);
                return (
                  <tr key={s.order} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{s.order}</td>
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className={`py-2 pr-4 ${STATUS_COLORS[s.status] ?? ""}`}>{s.status}</td>
                    <td className="py-2 pr-4">
                      {s.status === "running" ? (
                        <ProgressBar value={s.progress} />
                      ) : s.status === "success" ? (
                        <span className="text-zinc-400">100%</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {planStep ? `${planStep.durationMs} ms` : "—"}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">{planStep?.recordsTarget ?? "—"}</td>
                    <td className="py-2 pr-4">{s.recordsProcessed.toLocaleString()}</td>
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
