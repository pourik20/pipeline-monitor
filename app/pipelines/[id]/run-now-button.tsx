"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { runPipeline } from "@/lib/actions/pipelines";

export function RunNowButton({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await runPipeline(pipelineId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/runs/${result.data.id}`);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        onClick={(e) => { e.stopPropagation(); run(); }}
        disabled={pending}
        size="sm"
      >
        {pending ? "Starting…" : "Run now"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
