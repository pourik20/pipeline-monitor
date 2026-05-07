import { withErrorHandling } from "@/lib/with-error-handling";
import { runService } from "@/lib/services/pipeline-runner";
import { runFinalizer } from "@/lib/services/run-finalizer";
import { materialize } from "@/lib/services/run-progress-tracker";
import { systemClock } from "@/lib/clock";
import { connectToDatabase } from "@/lib/mongodb";
import { JobRunModel } from "@/lib/models/job-run";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertTransition } from "@/lib/domain/runState";
import { patchRunBodySchema } from "@/lib/schemas/run";
import mongoose from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const detail = await runService.getById(id);
  return Response.json(detail);
});

export const PATCH = withErrorHandling<Ctx>(async (req, { params }) => {
  const { id } = await params;

  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError(`Run ${id} not found`);

  const doc = await JobRunModel.findById(id);
  if (!doc) throw new NotFoundError(`Run ${id} not found`);

  const body = patchRunBodySchema.parse(await req.json());

  if (doc.status === body.status) {
    return Response.json({ id: String(doc._id), status: doc.status });
  }

  if (doc.status === "success" || doc.status === "failed") {
    throw new ConflictError(`Run is already in terminal state: ${doc.status}`);
  }

  assertTransition(doc.status, body.status);

  const snapshot = materialize(
    {
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
    },
    systemClock.now(),
  );

  await runFinalizer.finalize(doc._id, doc.status, {
    reason: body.status,
    errorMessage: body.errorMessage,
    recordsProcessed: snapshot.recordsProcessed,
  });

  return Response.json({ id: String(doc._id), status: body.status });
});
