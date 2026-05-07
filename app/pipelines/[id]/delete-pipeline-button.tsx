"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeletePipelineButton({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    await fetch(`/api/pipelines/${pipelineId}`, { method: "DELETE" });
    router.push("/pipelines");
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Opravdu smazat?</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void handleDelete()}
          disabled={busy}
        >
          {busy ? "Mazání…" : "Ano, smazat"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Zrušit
        </Button>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      Smazat pipeline
    </Button>
  );
}
