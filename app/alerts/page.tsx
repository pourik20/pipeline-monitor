import Link from "next/link";
import { alertRepository } from "@/lib/alerts/alert-repository";
import { alertListQuerySchema } from "@/lib/alerts/alert-rule-schema";
import { AlertRuleModel } from "@/lib/alerts/alert-rule-model";
import { PipelineModel } from "@/lib/pipelines/pipeline-model";
import { connectToDatabase } from "@/lib/shared/mongodb";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function flatten(params: SearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length > 0) out[k] = v[0];
  }
  return out;
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = flatten(await searchParams);
  const query = alertListQuerySchema.parse(raw);
  const { items, nextCursor } = await alertRepository.findAlerts(query);

  await connectToDatabase();
  const ruleIds = [...new Set(items.map((e) => e.ruleId))].filter(Boolean);
  const rules = await AlertRuleModel.find({ _id: { $in: ruleIds } });
  const ruleMap = new Map(rules.map((r) => [String(r._id), r]));

  const pipelineIds = [...new Set(rules.map((r) => r.pipelineId))].filter(Boolean);
  const pipelines = await PipelineModel.find({ _id: { $in: pipelineIds } });
  const pipelineMap = new Map(pipelines.map((p) => [String(p._id), p]));

  const runIds = [...new Set(items.map((e) => e.runId))].filter(Boolean);

  const prevCursor = raw.cursor ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Alert events</h1>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No alert events yet.</p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                <th className="py-2 pr-4 font-medium">Pipeline</th>
                <th className="py-2 pr-4 font-medium">Rule</th>
                <th className="py-2 pr-4 font-medium">Run</th>
                <th className="py-2 pr-4 font-medium">Message</th>
                <th className="py-2 pr-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => {
                const rule = ruleMap.get(String(event.ruleId));
                const pipeline = rule ? pipelineMap.get(String(rule.pipelineId)) : null;
                return (
                  <tr key={String(event._id)} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {pipeline ? (
                        <Link
                          href={`/pipelines/${String(rule?.pipelineId)}`}
                          className="hover:underline"
                        >
                          {pipeline.name}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{rule?.name ?? String(event.ruleId)}</td>
                    <td className="py-2 pr-4">
                      <Link
                        href={`/runs/${String(event.runId)}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {String(event.runId).slice(-8)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                      {event.message}
                    </td>
                    <td className="py-2 pr-4 text-zinc-500">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            {nextCursor && (
              <Link
                href={`/alerts?cursor=${nextCursor}&limit=${query.limit}`}
                className="text-sm hover:underline"
              >
                Next page →
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
