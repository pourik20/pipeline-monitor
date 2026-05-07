"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUSES = ["pending", "running", "success", "failed"] as const;

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
        <span className="mb-1 text-zinc-500">Pipeline</span>
        <select
          value={params.get("pipelineId") ?? ""}
          onChange={(e) => update("pipelineId", e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
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
        <span className="mb-1 text-zinc-500">Status</span>
        <select
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
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
        <span className="mb-1 text-zinc-500">From</span>
        <input
          type="datetime-local"
          value={params.get("from")?.slice(0, 16) ?? ""}
          onChange={(e) =>
            update("from", e.target.value ? new Date(e.target.value).toISOString() : "")
          }
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
      </label>
      <label className="flex flex-col text-xs">
        <span className="mb-1 text-zinc-500">To</span>
        <input
          type="datetime-local"
          value={params.get("to")?.slice(0, 16) ?? ""}
          onChange={(e) =>
            update("to", e.target.value ? new Date(e.target.value).toISOString() : "")
          }
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
        />
      </label>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        disabled={pending}
      >
        Reset
      </button>
    </div>
  );
}
