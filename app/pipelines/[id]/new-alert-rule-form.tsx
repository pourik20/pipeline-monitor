"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiError = { error: { code: string; message: string; details?: unknown } };

export function NewAlertRuleForm({ pipelineId }: { pipelineId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [condition, setCondition] = useState("status = 'failed'");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/alert-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineId, name, condition, enabled }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      const details = body?.error?.details;
      const msg = typeof details === "string" ? details : (body?.error?.message ?? `Request failed (${res.status})`);
      setError(msg);
      setSubmitting(false);
      return;
    }

    setName("");
    setCondition("status = 'failed'");
    setEnabled(true);
    setSubmitting(false);
    router.refresh();
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
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create alert rule"}
        </Button>
      </div>
    </form>
  );
}
