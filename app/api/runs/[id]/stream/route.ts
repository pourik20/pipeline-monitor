import { connectToDatabase } from "@/lib/mongodb";
import { JobRunModel } from "@/lib/models/job-run";
import { runFinalizer } from "@/lib/services/run-finalizer";
import { RealtimeBroadcaster } from "@/lib/services/realtime-broadcaster";
import type { RunForMaterialization } from "@/lib/services/run-progress-tracker";
import mongoose from "mongoose";

export const runtime = "nodejs";

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

  const broadcaster = new RealtimeBroadcaster();
  const encoder = new TextEncoder();
  const signal = req.signal;
  const docId = doc._id;
  const docStatus = doc.status;

  const stream = new ReadableStream({
    async start(controller) {
      const lastSnapshot = await broadcaster.stream(
        run,
        (snapshot) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
        },
        signal,
      );

      if (
        (lastSnapshot.status === "success" || lastSnapshot.status === "failed") &&
        docStatus === "running"
      ) {
        runFinalizer
          .finalize(docId, "running", {
            reason: lastSnapshot.status,
            errorMessage: lastSnapshot.errorMessage ?? undefined,
            recordsProcessed: lastSnapshot.recordsProcessed,
          })
          .catch(() => {});
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
