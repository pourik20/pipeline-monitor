import { NewDatasetForm } from "./new-dataset-form";

export default function NewDatasetPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New dataset</h1>
      <NewDatasetForm />
    </main>
  );
}
