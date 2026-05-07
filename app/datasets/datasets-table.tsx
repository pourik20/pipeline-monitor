"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteDataset as deleteDatasetAction } from "@/lib/actions/datasets";
import { toast } from "sonner";

interface Dataset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export function DatasetsTable({ datasets: initial }: { datasets: Dataset[] }) {
  const [datasets, setDatasets] = useState(initial);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const previous = datasets;
      setDatasets((prev) => prev.filter((d) => d.id !== id));
      const result = await deleteDatasetAction(id);
      if (!result.ok) {
        setDatasets(previous);
        toast.error(result.error.message);
      }
    });
  }

  if (datasets.length === 0) {
    return <p className="text-sm text-muted-foreground">No datasets yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-2 pr-4 font-medium">Name</th>
          <th className="py-2 pr-4 font-medium">Description</th>
          <th className="py-2 pr-4 font-medium">Created</th>
          <th className="py-2 pr-4 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((d) => (
          <tr key={d.id} className="border-b last:border-0">
            <td className="py-2 pr-4 font-medium">{d.name}</td>
            <td className="py-2 pr-4 text-muted-foreground">
              {d.description || "—"}
            </td>
            <td className="py-2 pr-4 text-muted-foreground">
              {new Date(d.createdAt).toLocaleString()}
            </td>
            <td className="py-2 pr-4 text-right">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(d.id)}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
