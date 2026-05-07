import type mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { JobRunModel } from "../models/job-run";
import { systemClock, type Clock } from "../clock";
import { assertTransition, type RunStatus } from "../domain/runState";

export interface FinalizeArgs {
  reason: "success" | "failed";
  errorMessage?: string;
  recordsProcessed?: number;
}

export class RunFinalizer {
  constructor(private readonly clock: Clock = systemClock) {}

  async finalize(
    runId: mongoose.Types.ObjectId,
    currentStatus: RunStatus,
    args: FinalizeArgs,
  ): Promise<void> {
    assertTransition(currentStatus, args.reason);
    await connectToDatabase();

    const finishedAt = this.clock.now();
    const update: Record<string, unknown> = { status: args.reason, finishedAt };
    if (args.errorMessage !== undefined) update.errorMessage = args.errorMessage;
    if (args.recordsProcessed !== undefined) update.recordsProcessed = args.recordsProcessed;

    await JobRunModel.findOneAndUpdate(
      { _id: runId, status: "running" },
      { $set: update },
    );
  }
}

export const runFinalizer = new RunFinalizer();
