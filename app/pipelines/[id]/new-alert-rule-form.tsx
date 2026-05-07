"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAlertRule } from "@/lib/actions/alert-rules";

export function NewAlertRuleForm({ pipelineId }: { pipelineId: string }) {
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("status = 'failed'");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAlertRule({ pipelineId, name, condition, enabled });
      if (!result.ok) {
        const details = result.error.details;
        setError(typeof details === "string" ? details : result.error.message);
        return;
      }
      setName("");
      setCondition("status = 'failed'");
      setEnabled(true);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-md border p-4 text-sm"
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Name</span>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Failed run alert"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Condition (JSONata)</span>
        <textarea
          required
          rows={3}
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="status = 'failed'"
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 font-mono text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <span className="text-xs text-muted-foreground">
          Available fields: status, startedAt, finishedAt, recordsProcessed, errorMessage, runtime (ms), pipelineId, pipelineVersionId, steps[]
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4"
        />
        <span className="font-medium">Enabled</span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create alert rule"}
        </Button>
      </div>
    </form>
  );
}
