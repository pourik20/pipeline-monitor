import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/shared/mongodb";
import { AlertRuleModel, type AlertRuleDoc } from "@/lib/alerts/alert-rule-model";
import { AlertEventModel, type AlertEventDoc } from "@/lib/alerts/alert-event-model";

export interface FindAlertsArgs {
  limit: number;
  cursor?: string;
}

export interface FindAlertsResult {
  items: AlertEventDoc[];
  nextCursor: string | null;
}

export const alertRepository = {
  async findRulesByPipelineId(pipelineId: string): Promise<AlertRuleDoc[]> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(pipelineId)) return [];
    return AlertRuleModel.find({ pipelineId: new mongoose.Types.ObjectId(pipelineId) });
  },

  async findEnabledRulesByPipelineId(pipelineId: mongoose.Types.ObjectId): Promise<AlertRuleDoc[]> {
    await connectToDatabase();
    return AlertRuleModel.find({ pipelineId, enabled: true });
  },

  async findRuleById(id: string): Promise<AlertRuleDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    return AlertRuleModel.findById(id);
  },

  async createRule(data: {
    pipelineId: mongoose.Types.ObjectId;
    name: string;
    condition: string;
    enabled: boolean;
    createdBy: string;
  }): Promise<AlertRuleDoc> {
    await connectToDatabase();
    return AlertRuleModel.create(data);
  },

  async upsertByRuleRun(
    ruleId: mongoose.Types.ObjectId,
    runId: mongoose.Types.ObjectId,
    message: string,
  ): Promise<{ created: boolean }> {
    await connectToDatabase();
    const res = await AlertEventModel.updateOne(
      { ruleId, runId },
      { $setOnInsert: { ruleId, runId, message, createdAt: new Date() } },
      { upsert: true },
    );
    return { created: res.upsertedCount > 0 };
  },

  async findAlerts(args: FindAlertsArgs): Promise<FindAlertsResult> {
    await connectToDatabase();
    const filter: Record<string, unknown> = {};
    if (args.cursor && mongoose.isValidObjectId(args.cursor)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(args.cursor) };
    }
    const limit = Math.max(1, Math.min(200, args.limit));
    const docs = await AlertEventModel.find(filter).sort({ _id: -1 }).limit(limit + 1);
    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    return { items, nextCursor: hasMore ? String(items[items.length - 1]._id) : null };
  },

  async updateRule(id: string, patch: { enabled?: boolean }): Promise<AlertRuleDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    return AlertRuleModel.findByIdAndUpdate(id, { $set: patch }, { new: true });
  },

  async deleteRule(id: string): Promise<boolean> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await AlertRuleModel.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },

  async findAlertById(id: string): Promise<AlertEventDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    return AlertEventModel.findById(id);
  },
};
