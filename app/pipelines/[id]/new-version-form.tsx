"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ApiError = { error: { code: string; message: string; details?: unknown } };

type StepInput = {
  name: string;
  minDurationMs: number;
  maxDurationMs: number;
  recordsTarget: number;
};

const initialStep = (): StepInput => ({
  name: "extract",
  minDurationMs: 1000,
  maxDurationMs: 3000,
  recordsTarget: 1000,
});

export function NewVersionForm({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [engine, setEngine] = useState("spark");
  const [query, setQuery] = useState("SELECT * FROM source");
  const [failureRate, setFailureRate] = useState(0);
  const [steps, setSteps] = useState<StepInput[]>([initialStep()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateStep(i: number, patch: Partial<StepInput>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, initialStep()]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/pipelines/${pipelineId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          engine,
          query,
          simulation: { steps, failureRate },
        },
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      setError(body?.error?.message ?? `Request failed (${res.status})`);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Engine</span>
          <input
            required
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Failure rate (0–1)</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={failureRate}
            onChange={(e) => setFailureRate(Number(e.target.value))}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Query</span>
        <textarea
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">Simulation steps</span>
          <button
            type="button"
            onClick={addStep}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            + Add step
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Name</span>
                <input
                  required
                  value={s.name}
                  onChange={(e) => updateStep(i, { name: e.target.value })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Min ms</span>
                <input
                  type="number"
                  min={0}
                  value={s.minDurationMs}
                  onChange={(e) =>
                    updateStep(i, { minDurationMs: Number(e.target.value) })
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Max ms</span>
                <input
                  type="number"
                  min={0}
                  value={s.maxDurationMs}
                  onChange={(e) =>
                    updateStep(i, { maxDurationMs: Number(e.target.value) })
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Records</span>
                <input
                  type="number"
                  min={0}
                  value={s.recordsTarget}
                  onChange={(e) =>
                    updateStep(i, { recordsTarget: Number(e.target.value) })
                  }
                  className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <button
                type="button"
                onClick={() => removeStep(i)}
                disabled={steps.length === 1}
                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create version"}
        </button>
      </div>
    </form>
  );
}
