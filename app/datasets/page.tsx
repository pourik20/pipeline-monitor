import Link from "next/link";
import { datasetService } from "@/lib/services/dataset-service";

export const dynamic = "force-dynamic";

export default async function DatasetsPage() {
  const datasets = await datasetService.list();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Datasets</h1>
        <Link
          href="/datasets/new"
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          New dataset
        </Link>
      </div>

      {datasets.length === 0 ? (
        <p className="text-sm text-zinc-500">No datasets yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Description</th>
              <th className="py-2 pr-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{d.name}</td>
                <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                  {d.description || "—"}
                </td>
                <td className="py-2 pr-4 text-zinc-500">
                  {new Date(d.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
