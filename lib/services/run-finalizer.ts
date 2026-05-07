import type mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { JobRunModel } from "../models/job-run";
import { systemClock, type Clock } from "../clock";
import { assertTransition, type RunStatus } from "../domain/runState";
import { alertEngine } from "./alert-engine";
import { notifier } from "./notifier";
import { alertRepository } from "../repositories/alert-repository";
import { logger } from "../logger";

export interface FinalizeArgs {
  reason: "success" | "failed";
  errorMessage?: string;
  recordsProcessed?: number;
  skipRuleIds?: string[];
}

export class RunFinalizer {
  constructor(private readonly clock: Clock = systemClock) {}

  async finalize(
    runId: mongoose.Types.ObjectId,
    currentStatus: RunStatus,
    args: FinalizeArgs,
  ): Promise<string[]> {
    assertTransition(currentStatus, args.reason);
    await connectToDatabase();

    const finishedAt = this.clock.now();
    const update: Record<string, unknown> = { status: args.reason, finishedAt };
    if (args.errorMessage !== undefined) update.errorMessage = args.errorMessage;
    if (args.recordsProcessed !== undefined) update.recordsProcessed = args.recordsProcessed;

    const doc = await JobRunModel.findOneAndUpdate(
      { _id: runId, status: "running" },
      { $set: update },
      { returnDocument: "after" },
    );

    if (!doc) return [];

    try {
      const rules = await alertRepository.findEnabledRulesByPipelineId(doc.pipelineId);
      const alreadyFired = new Set(args.skipRuleIds ?? []);
      const allMatches = await alertEngine.evaluate(rules, {
        _id: doc._id,
        pipelineId: doc.pipelineId,
        pipelineVersionId: doc.pipelineVersionId,
        status: args.reason,
        startedAt: doc.startedAt ?? null,
        finishedAt,
        recordsProcessed: (args.recordsProcessed ?? doc.recordsProcessed) as number,
        errorMessage: (args.errorMessage ?? doc.errorMessage) as string | null,
      });
      const matches = allMatches.filter((r) => !alreadyFired.has(String(r._id)));
      await notifier.notify(allMatches, { _id: doc._id, status: args.reason });
      return matches.map((r) => r.name);
    } catch (err) {
      logger.error({ runId, err }, "alert evaluation failed after finalization; ignoring");
      return [];
    }
  }
}

export const runFinalizer = new RunFinalizer();
