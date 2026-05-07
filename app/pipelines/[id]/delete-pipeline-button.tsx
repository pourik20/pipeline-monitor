"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deletePipeline } from "@/lib/actions/pipelines";
import { toast } from "sonner";

export function DeletePipelineButton({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePipeline(pipelineId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.push("/pipelines");
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Opravdu smazat?</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={pending}
        >
          {pending ? "Mazání…" : "Ano, smazat"}
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
