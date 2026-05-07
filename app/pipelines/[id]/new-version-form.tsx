"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPipelineVersion } from "@/lib/actions/pipeline-versions";

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
  const [engine, setEngine] = useState("spark");
  const [query, setQuery] = useState("SELECT * FROM source");
  const [failureRate, setFailureRate] = useState(0);
  const [steps, setSteps] = useState<StepInput[]>([initialStep()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateStep(i: number, patch: Partial<StepInput>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, initialStep()]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPipelineVersion(pipelineId, {
        config: { engine, query, simulation: { steps, failureRate } },
      });
      if (!result.ok) {
        setError(result.error.message);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-md border p-4 text-sm"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Engine</span>
          <Input
            required
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">Failure rate (0–1)</span>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={failureRate}
            onChange={(e) => setFailureRate(Number(e.target.value))}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Query</span>
        <textarea
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 font-mono text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-medium">Execution steps</span>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            + Add step
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded border p-2"
            >
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Name</span>
                <Input
                  required
                  value={s.name}
                  onChange={(e) => updateStep(i, { name: e.target.value })}
                  className="h-7 px-2 text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Min ms</span>
                <Input
                  type="number"
                  min={0}
                  value={s.minDurationMs}
                  onChange={(e) => updateStep(i, { minDurationMs: Number(e.target.value) })}
                  className="h-7 px-2 text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Max ms</span>
                <Input
                  type="number"
                  min={0}
                  value={s.maxDurationMs}
                  onChange={(e) => updateStep(i, { maxDurationMs: Number(e.target.value) })}
                  className="h-7 px-2 text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Records</span>
                <Input
                  type="number"
                  min={0}
                  value={s.recordsTarget}
                  onChange={(e) => updateStep(i, { recordsTarget: Number(e.target.value) })}
                  className="h-7 px-2 text-xs"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeStep(i)}
                disabled={steps.length === 1}
                className="h-7 px-2 text-xs"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create version"}
        </Button>
      </div>
    </form>
  );
}
