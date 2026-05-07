"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUSES = ["pending", "running", "success", "failed"] as const;

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RunFilters({ pipelineOptions }: { pipelineOptions: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    startTransition(() => {
      router.replace(`/runs?${next.toString()}`);
    });
  }

  function reset() {
    startTransition(() => {
      router.replace("/runs");
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-xs">
        <span className="mb-1 text-muted-foreground">Pipeline</span>
        <select
          value={params.get("pipelineId") ?? ""}
          onChange={(e) => update("pipelineId", e.target.value)}
          className={selectClass}
        >
          <option value="">All</option>
          {pipelineOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        <span className="mb-1 text-muted-foreground">Status</span>
        <select
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
          className={selectClass}
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs">
        <span className="mb-1 text-muted-foreground">From</span>
        <Input
          type="datetime-local"
          value={params.get("from")?.slice(0, 16) ?? ""}
          onChange={(e) =>
            update("from", e.target.value ? new Date(e.target.value).toISOString() : "")
          }
          className="w-auto"
        />
      </label>
      <label className="flex flex-col text-xs">
        <span className="mb-1 text-muted-foreground">To</span>
        <Input
          type="datetime-local"
          value={params.get("to")?.slice(0, 16) ?? ""}
          onChange={(e) =>
            update("to", e.target.value ? new Date(e.target.value).toISOString() : "")
          }
          className="w-auto"
        />
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={reset}
        disabled={pending}
      >
        Reset
      </Button>
    </div>
  );
}
