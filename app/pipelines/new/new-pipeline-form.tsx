"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ApiError = { error: { code: string; message: string; details?: unknown } };

type DatasetOption = { id: string; name: string };

export function NewPipelineForm({ datasets }: { datasets: DatasetOption[] }) {
  const router = useRouter();
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!datasetId) {
      setError("Please select a dataset.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId, name, description, schedule }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      setError(body?.error?.message ?? `Request failed (${res.status})`);
      setSubmitting(false);
      return;
    }

    const created = (await res.json()) as { id: string };
    router.push(`/pipelines/${created.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Dataset</span>
        {datasets.length === 0 ? (
          <p className="text-sm text-red-600">
            No datasets exist yet — create one first.
          </p>
        ) : (
          <select
            required
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Schedule (cron, optional)</span>
        <input
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 * * * *"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Description</span>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || datasets.length === 0}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create pipeline"}
        </button>
      </div>
    </form>
  );
}
