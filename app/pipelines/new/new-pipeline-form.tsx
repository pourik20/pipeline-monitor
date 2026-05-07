"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPipeline } from "@/lib/actions/pipelines";

type DatasetOption = { id: string; name: string };

export function NewPipelineForm({ datasets }: { datasets: DatasetOption[] }) {
  const router = useRouter();
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schedule, setSchedule] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!datasetId) {
      setError("Please select a dataset.");
      return;
    }

    startTransition(async () => {
      const result = await createPipeline({ datasetId, name, description, schedule });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/pipelines/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Dataset</span>
        {datasets.length === 0 ? (
          <p className="text-sm text-destructive">
            No datasets exist yet — create one first.
          </p>
        ) : (
          <select
            required
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Schedule (cron, optional)</span>
        <Input
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 * * * *"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Description</span>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="h-auto min-h-[96px] w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || datasets.length === 0}>
          {pending ? "Creating…" : "Create pipeline"}
        </Button>
      </div>
    </form>
  );
}
