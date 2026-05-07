"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Dataset {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export function DatasetsTable({ datasets: initial }: { datasets: Dataset[] }) {
  const router = useRouter();
  const [datasets, setDatasets] = useState(initial);

  async function deleteDataset(id: string) {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/datasets/${id}`, { method: "DELETE" });
    router.refresh();
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
                onClick={() => void deleteDataset(d.id)}
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
