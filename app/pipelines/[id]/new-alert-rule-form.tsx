"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

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
      className="flex flex-col gap-4 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800"
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Failed run alert"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
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
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="text-xs text-zinc-500">
          Available fields: status, startedAt, finishedAt, recordsProcessed, errorMessage, runtime (ms), pipelineId, pipelineVersionId, steps[]
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="font-medium">Enabled</span>
      </label>

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
          {submitting ? "Creating…" : "Create alert rule"}
        </button>
      </div>
    </form>
  );
}
