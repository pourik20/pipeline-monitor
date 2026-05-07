import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { JobRunModel, type JobRunDoc } from "../models/job-run";
import type { RunStatus } from "../domain/runState";

type RunFilter = Record<string, unknown>;

export interface FindFilteredArgs {
  pipelineId?: string;
  status?: RunStatus;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: string;
}

export interface FindFilteredResult {
  items: JobRunDoc[];
  nextCursor: string | null;
}

export const runRepository = {
  async findFiltered(args: FindFilteredArgs): Promise<FindFilteredResult> {
    await connectToDatabase();

    const filter: RunFilter = {};

    if (args.pipelineId && mongoose.isValidObjectId(args.pipelineId)) {
      filter.pipelineId = new mongoose.Types.ObjectId(args.pipelineId);
    } else if (args.pipelineId) {
      return { items: [], nextCursor: null };
    }

    if (args.status) filter.status = args.status;

    if (args.from || args.to) {
      const range: Record<string, Date> = {};
      if (args.from) range.$gte = args.from;
      if (args.to) range.$lte = args.to;
      filter.createdAt = range;
    }

    if (args.cursor && mongoose.isValidObjectId(args.cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(args.cursor) };
    }

    const limit = Math.max(1, Math.min(200, args.limit));
    const docs = await JobRunModel.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

    return { items, nextCursor };
  },
};
