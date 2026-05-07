import { connectToDatabase } from "@/lib/mongodb";
import { JobRunModel } from "@/lib/models/job-run";
import { runFinalizer } from "@/lib/services/run-finalizer";
import { alertEngine } from "@/lib/services/alert-engine";
import { alertRepository } from "@/lib/repositories/alert-repository";
import { notifier } from "@/lib/services/notifier";
import { materialize, type RunForMaterialization, type MaterializedSnapshot } from "@/lib/services/run-progress-tracker";
import { systemClock } from "@/lib/clock";
import mongoose from "mongoose";

export const runtime = "nodejs";

const TICK_INTERVAL_MS = 1500;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;

  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ error: { code: "not_found", message: "Run not found" } }, { status: 404 });
  }

  const doc = await JobRunModel.findById(id);
  if (!doc) {
    return Response.json({ error: { code: "not_found", message: "Run not found" } }, { status: 404 });
  }

  const run: RunForMaterialization = {
    id: String(doc._id),
    startedAt: doc.startedAt ? new Date(doc.startedAt) : null,
    status: doc.status,
    recordsProcessed: doc.recordsProcessed,
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt) : null,
    errorMessage: doc.errorMessage ?? null,
    plan: {
      steps: doc.plan.steps.map((s) => ({
        name: s.name,
        order: s.order,
        durationMs: s.durationMs,
        recordsTarget: s.recordsTarget,
      })),
      willFail: doc.plan.willFail,
      failAtStepIndex:
        typeof doc.plan.failAtStepIndex === "number" ? doc.plan.failAtStepIndex : null,
    },
  };

  const encoder = new TextEncoder();
  const signal = req.signal;
  const docId = doc._id;
  const docStatus = doc.status;

  const docPipelineId = doc.pipelineId;
  const docVersionId = doc.pipelineVersionId;
  const rules = await alertRepository.findEnabledRulesByPipelineId(docPipelineId);
  const firedRuleIds = new Set<string>();

  async function evalAndEmitAlerts(
    snapshot: MaterializedSnapshot,
    controller: ReadableStreamDefaultController,
  ) {
    if (rules.length === 0) return;
    const now = systemClock.now();
    const matches = await alertEngine.evaluate(
      rules,
      {
        _id: docId,
        pipelineId: docPipelineId,
        pipelineVersionId: docVersionId,
        status: snapshot.status,
        startedAt: run.startedAt,
        finishedAt: snapshot.finishedAt ? new Date(snapshot.finishedAt) : null,
        recordsProcessed: snapshot.recordsProcessed,
        errorMessage: snapshot.errorMessage,
        steps: snapshot.steps.map((s) => ({
          name: s.name,
          order: s.order,
          status: s.status,
          recordsProcessed: s.recordsProcessed,
        })),
      },
      now,
    );
    const newMatches = matches.filter((r) => !firedRuleIds.has(String(r._id)));
    if (newMatches.length > 0) {
      newMatches.forEach((r) => firedRuleIds.add(String(r._id)));
      notifier.notify(newMatches, { _id: docId, status: snapshot.status }).catch(() => {});
      controller.enqueue(
        encoder.encode(`event: alerts\ndata: ${JSON.stringify(newMatches.map((r) => r.name))}\n\n`),
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      let lastSnapshot: MaterializedSnapshot = materialize(run, systemClock.now());
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(lastSnapshot)}\n\n`));
      await evalAndEmitAlerts(lastSnapshot, controller);

      while (lastSnapshot.status === "running" && !signal?.aborted) {
        await sleep(TICK_INTERVAL_MS, signal);
        if (signal?.aborted) break;
        lastSnapshot = materialize(run, systemClock.now());
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(lastSnapshot)}\n\n`));
        await evalAndEmitAlerts(lastSnapshot, controller);
      }

      if (
        (lastSnapshot.status === "success" || lastSnapshot.status === "failed") &&
        docStatus === "running"
      ) {
        const triggeredRuleNames = await runFinalizer
          .finalize(docId, "running", {
            reason: lastSnapshot.status,
            errorMessage: lastSnapshot.errorMessage ?? undefined,
            recordsProcessed: lastSnapshot.recordsProcessed,
            skipRuleIds: [...firedRuleIds],
          })
          .catch(() => [] as string[]);

        if (triggeredRuleNames.length > 0) {
          controller.enqueue(
            encoder.encode(`event: alerts\ndata: ${JSON.stringify(triggeredRuleNames)}\n\n`),
          );
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
