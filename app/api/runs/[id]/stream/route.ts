import "@/lib/server-init";
import { connectToDatabase } from "@/lib/shared/mongodb";
import { JobRunModel } from "@/lib/runs/job-run-model";
import { runFinalizer } from "@/lib/runs/run-finalizer";
import { materialize, type RunForMaterialization, type MaterializedSnapshot } from "@/lib/runs/progress-tracker";
import { systemClock } from "@/lib/shared/clock";
import { bus } from "@/lib/events";
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
  const docPipelineId = doc.pipelineId;
  const docVersionId = doc.pipelineVersionId;
  const docStatus = doc.status;
  const runIdStr = String(docId);

  function publishProgress(snapshot: MaterializedSnapshot) {
    bus.publish({
      type: "runProgressed",
      runId: docId,
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
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const unsubscribe = bus.on("alertFired", (e) => {
        if (String(e.runId) !== runIdStr) return;
        controller.enqueue(
          encoder.encode(`event: alerts\ndata: ${JSON.stringify([e.ruleName])}\n\n`),
        );
      });

      try {
        let lastSnapshot = materialize(run, systemClock.now());
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(lastSnapshot)}\n\n`));
        publishProgress(lastSnapshot);

        while (lastSnapshot.status === "running" && !signal?.aborted) {
          await sleep(TICK_INTERVAL_MS, signal);
          if (signal?.aborted) break;
          lastSnapshot = materialize(run, systemClock.now());
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(lastSnapshot)}\n\n`));
          publishProgress(lastSnapshot);
        }

        if (
          (lastSnapshot.status === "success" || lastSnapshot.status === "failed") &&
          docStatus === "running"
        ) {
          await runFinalizer
            .finalize(docId, "running", {
              reason: lastSnapshot.status,
              errorMessage: lastSnapshot.errorMessage ?? undefined,
              recordsProcessed: lastSnapshot.recordsProcessed,
            })
            .catch(() => false);
          // give the bus a tick to deliver alertFired events from finalization
          await sleep(50);
        }
      } finally {
        unsubscribe();
        controller.close();
      }
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
