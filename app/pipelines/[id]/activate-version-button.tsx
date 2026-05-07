"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { activatePipelineVersion } from "@/lib/actions/pipeline-versions";

export function ActivateVersionButton({
  pipelineId,
  versionId,
}: {
  pipelineId: string;
  versionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function activate() {
    setError(null);
    startTransition(async () => {
      const result = await activatePipelineVersion(pipelineId, versionId);
      if (!result.ok) setError(result.error.message);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={activate} disabled={pending}>
        {pending ? "Activating…" : "Activate"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
