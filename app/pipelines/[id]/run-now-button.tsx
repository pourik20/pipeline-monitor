"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        onClick={(e) => { e.stopPropagation(); void run(); }}
        disabled={busy}
        size="sm"
      >
        {busy ? "Starting…" : "Run now"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
