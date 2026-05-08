import Link from "next/link";
import {
  ActivityIcon,
  AlertTriangleIcon,
  BellIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  PlayCircleIcon,
  WorkflowIcon,
} from "lucide-react";
import { connectToDatabase } from "@/lib/shared/mongodb";
import { DatasetModel } from "@/lib/datasets/dataset-model";
import { PipelineModel } from "@/lib/pipelines/pipeline-model";
import { JobRunModel } from "@/lib/runs/job-run-model";
import { AlertEventModel } from "@/lib/alerts/alert-event-model";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

interface DashboardCounts {
  datasets: number;
  pipelines: number;
  activePipelines: number;
  runs7d: number;
  failedRuns7d: number;
  alerts7d: number;
}

interface RunningRunSummary {
  id: string;
  pipelineId: string;
  pipelineName: string;
  startedAt: string | null;
}

async function loadDashboard(): Promise<{
  counts: DashboardCounts;
  running: RunningRunSummary[];
}> {
  await connectToDatabase();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    datasets,
    pipelines,
    activePipelines,
    runs7d,
    failedRuns7d,
    alerts7d,
    runningDocs,
  ] = await Promise.all([
    DatasetModel.estimatedDocumentCount(),
    PipelineModel.countDocuments({}),
    PipelineModel.countDocuments({ active: true }),
    JobRunModel.countDocuments({ createdAt: { $gte: since } }),
    JobRunModel.countDocuments({ status: "failed", createdAt: { $gte: since } }),
    AlertEventModel.countDocuments({ createdAt: { $gte: since } }),
    JobRunModel.find({ status: { $in: ["pending", "running"] } })
      .sort({ startedAt: -1 })
      .limit(10),
  ]);

  const pipelineIds = [...new Set(runningDocs.map((r) => String(r.pipelineId)))];
  const pipelineDocs = await PipelineModel.find({ _id: { $in: pipelineIds } });
  const pipelineNameById = new Map(
    pipelineDocs.map((p) => [String(p._id), p.name]),
  );

  const running: RunningRunSummary[] = runningDocs.map((r) => ({
    id: String(r._id),
    pipelineId: String(r.pipelineId),
    pipelineName:
      pipelineNameById.get(String(r.pipelineId)) ?? String(r.pipelineId),
    startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
  }));

  return {
    counts: {
      datasets,
      pipelines,
      activePipelines,
      runs7d,
      failedRuns7d,
      alerts7d,
    },
    running,
  };
}

interface MetricCardProps {
  label: string;
  value: number;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  tone?: "default" | "destructive";
}

function MetricCard({
  label,
  value,
  href,
  icon: Icon,
  description,
  tone = "default",
}: MetricCardProps) {
  return (
    <Link href={href} className="group">
      <Card className="transition group-hover:ring-foreground/20">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Icon className="size-4" />
            {label}
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tracking-tight">
            {value}
            {tone === "destructive" && value > 0 && (
              <Badge variant="destructive" className="ml-2 align-middle">
                attention
              </Badge>
            )}
          </CardTitle>
          {description && (
            <CardDescription className="text-xs">{description}</CardDescription>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const { counts, running } = await loadDashboard();
  const successRate7d =
    counts.runs7d === 0
      ? null
      : Math.round(((counts.runs7d - counts.failedRuns7d) / counts.runs7d) * 100);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Platform health at a glance — last 7 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {successRate7d !== null && (
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2Icon className="size-3.5" />
              {successRate7d}% success (7d)
            </Badge>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/pipelines/new">New pipeline</Link>
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Datasets"
          value={counts.datasets}
          href="/datasets"
          icon={DatabaseIcon}
        />
        <MetricCard
          label="Pipelines"
          value={counts.pipelines}
          href="/pipelines"
          icon={WorkflowIcon}
          description={`${counts.activePipelines} active`}
        />
        <MetricCard
          label="Active pipelines"
          value={counts.activePipelines}
          href="/pipelines"
          icon={PlayCircleIcon}
        />
        <MetricCard
          label="Runs (7d)"
          value={counts.runs7d}
          href="/runs"
          icon={ActivityIcon}
        />
        <MetricCard
          label="Failed runs (7d)"
          value={counts.failedRuns7d}
          href="/runs?status=failed"
          icon={AlertTriangleIcon}
          tone="destructive"
        />
        <MetricCard
          label="Alerts (7d)"
          value={counts.alerts7d}
          href="/alerts"
          icon={BellIcon}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Currently running</CardTitle>
          <CardDescription>
            Live job runs streaming over Server-Sent Events.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {running.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <ActivityIcon className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No runs in flight.</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {running.map((r, i) => (
                <li key={r.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between gap-4 px-6 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="relative flex size-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={`/pipelines/${r.pipelineId}`}
                          className="truncate text-sm font-medium hover:underline"
                        >
                          {r.pipelineName}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          Started{" "}
                          {r.startedAt
                            ? new Date(r.startedAt).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/runs/${r.id}`}>View live</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
