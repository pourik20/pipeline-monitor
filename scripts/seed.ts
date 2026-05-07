import mongoose from "mongoose";
import { connectToDatabase } from "../lib/mongodb";
import { UserModel } from "../lib/models/user";
import { DatasetModel } from "../lib/models/dataset";
import { PipelineModel } from "../lib/models/pipeline";
import { PipelineVersionModel } from "../lib/models/pipeline-version";
import { JobRunModel } from "../lib/models/job-run";
import { JobRunStepModel } from "../lib/models/job-run-step";
import { AlertRuleModel } from "../lib/models/alert-rule";
import { AlertEventModel } from "../lib/models/alert-event";

interface SimStep {
  name: string;
  minDurationMs: number;
  maxDurationMs: number;
  recordsTarget: number;
}

const STANDARD_STEPS: SimStep[] = [
  { name: "extract", minDurationMs: 4000, maxDurationMs: 8000, recordsTarget: 50_000 },
  { name: "transform", minDurationMs: 6000, maxDurationMs: 12_000, recordsTarget: 50_000 },
  { name: "load", minDurationMs: 3000, maxDurationMs: 6000, recordsTarget: 50_000 },
];

const RUNNING_STEPS: SimStep[] = [
  { name: "extract", minDurationMs: 8000, maxDurationMs: 8000, recordsTarget: 120_000 },
  { name: "transform", minDurationMs: 18_000, maxDurationMs: 18_000, recordsTarget: 120_000 },
  { name: "load", minDurationMs: 14_000, maxDurationMs: 14_000, recordsTarget: 120_000 },
];

function pickStepDuration(s: SimStep): number {
  return Math.floor(s.minDurationMs + Math.random() * (s.maxDurationMs - s.minDurationMs + 1));
}

function planFromSimulation(steps: SimStep[], willFail: boolean) {
  const sampled = steps.map((s, i) => ({
    name: s.name,
    order: i,
    durationMs: pickStepDuration(s),
    recordsTarget: s.recordsTarget,
  }));
  const failAtStepIndex = willFail
    ? Math.min(steps.length - 1, Math.floor(Math.random() * steps.length))
    : null;
  return { steps: sampled, willFail, failAtStepIndex };
}

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not established");

  console.log("Dropping existing collections...");
  const existingCollections = await db.listCollections().toArray();
  const names = new Set(existingCollections.map((c) => c.name));
  const collectionsToDrop = [
    "users",
    "datasets",
    "pipelines",
    "pipelineversions",
    "jobruns",
    "jobrunsteps",
    "alertrules",
    "alertevents",
  ];
  for (const name of collectionsToDrop) {
    if (names.has(name)) {
      await db.dropCollection(name);
    }
  }

  // Recreate indexes that the models expect.
  await Promise.all([
    UserModel.syncIndexes(),
    DatasetModel.syncIndexes(),
    PipelineModel.syncIndexes(),
    PipelineVersionModel.syncIndexes(),
    JobRunModel.syncIndexes(),
    JobRunStepModel.syncIndexes(),
    AlertRuleModel.syncIndexes(),
    AlertEventModel.syncIndexes(),
  ]);

  console.log("Creating admin user...");
  const admin = await UserModel.create({ email: "admin@demo", role: "admin" });

  console.log("Creating datasets...");
  const datasetSpecs = [
    { name: "vehicle_telemetry", description: "Real-time telemetry stream from autonomous Tesla fleet" },
    { name: "trip_records", description: "Completed trips with route, fares, and durations" },
    { name: "charging_sessions", description: "Supercharger session events for the fleet" },
    { name: "customer_events", description: "Booking, cancellation, and rating events" },
    { name: "fleet_incidents", description: "Reported anomalies and safety incidents" },
  ];
  const datasets = await DatasetModel.insertMany(
    datasetSpecs.map((d) => ({
      name: d.name,
      description: d.description,
      owner: admin._id,
      createdBy: admin._id,
      schemaVersion: 1,
    })),
  );
  const datasetByName = new Map(datasets.map((d) => [d.name, d]));

  console.log("Creating pipelines and versions...");
  const pipelineSpecs: Array<{
    name: string;
    dataset: string;
    description: string;
    schedule: string;
    versions: Array<{ engine: string; query: string; steps: SimStep[]; failureRate: number }>;
  }> = [
    {
      name: "telemetry_ingest",
      dataset: "vehicle_telemetry",
      description: "Ingest telemetry batches from edge buffer into the warehouse",
      schedule: "*/5 * * * *",
      versions: [
        { engine: "spark", query: "SELECT * FROM telemetry_raw", steps: STANDARD_STEPS, failureRate: 0.1 },
        { engine: "spark", query: "SELECT * FROM telemetry_raw_v2", steps: STANDARD_STEPS, failureRate: 0.15 },
      ],
    },
    {
      name: "daily_trip_rollup",
      dataset: "trip_records",
      description: "Daily rollup of trip records into reporting marts",
      schedule: "0 2 * * *",
      versions: [
        { engine: "spark", query: "SELECT date, count(*) FROM trips GROUP BY 1", steps: STANDARD_STEPS, failureRate: 0.05 },
      ],
    },
    {
      name: "charging_optimization",
      dataset: "charging_sessions",
      description: "Compute charging cost-per-kWh and route optimization metrics",
      schedule: "0 */4 * * *",
      versions: [
        { engine: "spark", query: "SELECT vehicle_id, sum(kwh) FROM charging GROUP BY 1", steps: STANDARD_STEPS, failureRate: 0.1 },
        { engine: "spark", query: "SELECT vehicle_id, sum(kwh), avg(price) FROM charging GROUP BY 1", steps: STANDARD_STEPS, failureRate: 0.1 },
      ],
    },
    {
      name: "customer_ltv",
      dataset: "customer_events",
      description: "Recompute customer lifetime value and churn segments",
      schedule: "0 3 * * *",
      versions: [
        { engine: "spark", query: "SELECT customer_id, sum(fare) FROM events GROUP BY 1", steps: STANDARD_STEPS, failureRate: 0.05 },
      ],
    },
    {
      name: "incident_classification",
      dataset: "fleet_incidents",
      description: "Classify and route fleet incidents for ops review",
      schedule: "*/15 * * * *",
      versions: [
        { engine: "spark", query: "SELECT * FROM incidents WHERE classified IS NULL", steps: STANDARD_STEPS, failureRate: 0.2 },
      ],
    },
    {
      name: "fleet_health_export",
      dataset: "vehicle_telemetry",
      description: "Hourly export of fleet health snapshot to BI",
      schedule: "0 * * * *",
      versions: [
        { engine: "spark", query: "SELECT * FROM telemetry_health", steps: STANDARD_STEPS, failureRate: 0.05 },
      ],
    },
  ];

  type CreatedPipeline = {
    pipelineId: mongoose.Types.ObjectId;
    activeVersionId: mongoose.Types.ObjectId;
    name: string;
  };
  const createdPipelines: CreatedPipeline[] = [];

  for (const spec of pipelineSpecs) {
    const dataset = datasetByName.get(spec.dataset);
    if (!dataset) throw new Error(`Missing dataset ${spec.dataset}`);

    const pipeline = await PipelineModel.create({
      datasetId: dataset._id,
      name: spec.name,
      description: spec.description,
      schedule: spec.schedule,
      active: true,
      createdBy: admin._id,
    });

    const versions: mongoose.Types.ObjectId[] = [];
    for (let i = 0; i < spec.versions.length; i++) {
      const v = spec.versions[i];
      const isActive = i === spec.versions.length - 1;
      const created = await PipelineVersionModel.create({
        pipelineId: pipeline._id,
        version: i + 1,
        active: isActive,
        config: {
          engine: v.engine,
          query: v.query,
          simulation: { steps: v.steps, failureRate: v.failureRate },
        },
        createdBy: admin._id,
      });
      versions.push(created._id);
    }

    createdPipelines.push({
      pipelineId: pipeline._id,
      activeVersionId: versions[versions.length - 1],
      name: spec.name,
    });
  }

  console.log("Creating historical job runs...");
  const now = Date.now();
  const HISTORICAL_COUNT = 20;
  const failedRunIds: mongoose.Types.ObjectId[] = [];
  const historicalRuns: Array<{ pipelineName: string; runId: mongoose.Types.ObjectId }> = [];

  for (let i = 0; i < HISTORICAL_COUNT; i++) {
    const pipeline = createdPipelines[i % createdPipelines.length];
    // Spread runs over the last 7 days.
    const startedAt = new Date(now - (i + 1) * 8 * 60 * 60 * 1000 - Math.floor(Math.random() * 30 * 60 * 1000));
    const willFail = Math.random() < 0.3;
    const plan = planFromSimulation(STANDARD_STEPS, willFail);
    const totalDuration = plan.steps.reduce((sum, s) => sum + s.durationMs, 0);
    const finishedAt = new Date(startedAt.getTime() + totalDuration);
    const status: "success" | "failed" = willFail ? "failed" : "success";

    const recordsProcessed = willFail
      ? plan.steps.slice(0, plan.failAtStepIndex ?? 0).reduce((sum, s) => sum + s.recordsTarget, 0)
      : plan.steps.reduce((sum, s) => sum + s.recordsTarget, 0);

    const run = await JobRunModel.create({
      pipelineId: pipeline.pipelineId,
      pipelineVersionId: pipeline.activeVersionId,
      status,
      startedAt,
      finishedAt,
      recordsProcessed,
      errorMessage: willFail ? "Run failed during simulation" : null,
      plan,
    });

    if (willFail) failedRunIds.push(run._id);
    historicalRuns.push({ pipelineName: pipeline.name, runId: run._id });

    await JobRunStepModel.insertMany(
      plan.steps.map((s, idx) => {
        let stepStatus: "success" | "failed" | "pending" = "success";
        let stepRecords = s.recordsTarget;
        if (willFail && plan.failAtStepIndex !== null) {
          if (idx < plan.failAtStepIndex) {
            stepStatus = "success";
          } else if (idx === plan.failAtStepIndex) {
            stepStatus = "failed";
            stepRecords = 0;
          } else {
            stepStatus = "pending";
            stepRecords = 0;
          }
        }
        return {
          runId: run._id,
          order: s.order,
          name: s.name,
          status: stepStatus,
          startedAt:
            stepStatus === "pending"
              ? null
              : new Date(startedAt.getTime() + plan.steps.slice(0, idx).reduce((sum, x) => sum + x.durationMs, 0)),
          finishedAt:
            stepStatus === "pending"
              ? null
              : new Date(startedAt.getTime() + plan.steps.slice(0, idx + 1).reduce((sum, x) => sum + x.durationMs, 0)),
          recordsProcessed: stepRecords,
        };
      }),
    );
  }

  console.log("Creating one currently-running job run...");
  const runningPipeline = createdPipelines[0];
  const runningPlan = planFromSimulation(RUNNING_STEPS, false);
  const runningStartedAt = new Date(now);
  const runningRun = await JobRunModel.create({
    pipelineId: runningPipeline.pipelineId,
    pipelineVersionId: runningPipeline.activeVersionId,
    status: "running",
    startedAt: runningStartedAt,
    finishedAt: null,
    recordsProcessed: 0,
    errorMessage: null,
    plan: runningPlan,
  });
  await JobRunStepModel.insertMany(
    runningPlan.steps.map((s) => ({
      runId: runningRun._id,
      order: s.order,
      name: s.name,
      status: "pending" as const,
      recordsProcessed: 0,
    })),
  );

  console.log("Creating alert rules...");
  const alertSpecs = [
    {
      pipeline: "telemetry_ingest",
      name: "telemetry failure",
      condition: "status = 'failed'",
    },
    {
      pipeline: "daily_trip_rollup",
      name: "long-running trip rollup",
      condition: "runtime > 600000",
    },
    {
      pipeline: "incident_classification",
      name: "incident pipeline failure",
      condition: "status = 'failed'",
    },
    {
      pipeline: "charging_optimization",
      name: "low throughput",
      condition: "status = 'success' and recordsProcessed < 100000",
    },
  ];
  const ruleByPipeline = new Map<string, mongoose.Types.ObjectId>();
  for (const spec of alertSpecs) {
    const pipeline = createdPipelines.find((p) => p.name === spec.pipeline);
    if (!pipeline) continue;
    const rule = await AlertRuleModel.create({
      pipelineId: pipeline.pipelineId,
      name: spec.name,
      condition: spec.condition,
      enabled: true,
      createdBy: String(admin._id),
    });
    ruleByPipeline.set(pipeline.name, rule._id);
  }

  console.log("Creating historical alert events...");
  let alertsCreated = 0;
  for (const failedRunId of failedRunIds) {
    if (alertsCreated >= 5) break;
    const failedRun = await JobRunModel.findById(failedRunId);
    if (!failedRun) continue;
    const pipeline = createdPipelines.find((p) =>
      p.pipelineId.equals(failedRun.pipelineId),
    );
    if (!pipeline) continue;
    const ruleId = ruleByPipeline.get(pipeline.name);
    if (!ruleId) continue;
    await AlertEventModel.create({
      ruleId,
      runId: failedRunId,
      message: `Pipeline ${pipeline.name} run failed`,
    });
    alertsCreated++;
  }

  console.log(
    `Seed complete: ${datasets.length} datasets, ${createdPipelines.length} pipelines, ` +
      `${HISTORICAL_COUNT} historical runs + 1 running, ${alertSpecs.length} alert rules, ` +
      `${alertsCreated} alert events.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
