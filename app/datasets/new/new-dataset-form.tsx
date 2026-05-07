"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDataset } from "@/lib/actions/datasets";

export function NewDatasetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createDataset({ name, description });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push("/datasets");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create dataset"}
        </Button>
      </div>
    </form>
  );
}
