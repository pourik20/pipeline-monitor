"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiError = { error: { code: string; message: string } };

export function ActivateVersionButton({
  pipelineId,
  versionId,
}: {
  pipelineId: string;
  versionId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/pipelines/${pipelineId}/versions/${versionId}/activate`,
      { method: "PATCH" },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      setError(body?.error?.message ?? `Request failed (${res.status})`);
      setBusy(false);
      return;
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={activate}
        disabled={busy}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {busy ? "Activating…" : "Activate"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
