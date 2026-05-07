"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiError = { error: { code: string; message: string } };
type RunResponse = { id: string };

export function RunNowButton({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pipelines/${pipelineId}/run`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      setError(body?.error?.message ?? `Request failed (${res.status})`);
      setBusy(false);
      return;
    }
    const data = (await res.json()) as RunResponse;
    setBusy(false);
    router.push(`/runs/${data.id}`);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {busy ? "Starting…" : "Run now"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
