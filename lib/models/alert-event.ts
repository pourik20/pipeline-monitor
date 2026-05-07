import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

const alertEventSchema = new Schema(
  {
    ruleId: { type: Schema.Types.ObjectId, ref: "AlertRule", required: true },
    runId: { type: Schema.Types.ObjectId, ref: "JobRun", required: true },
    message: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

alertEventSchema.index({ createdAt: -1 });
alertEventSchema.index(
  { ruleId: 1, runId: 1 },
  { unique: true, partialFilterExpression: { ruleId: { $exists: true } } },
);

export type AlertEvent = InferSchemaType<typeof alertEventSchema>;
export type AlertEventDoc = HydratedDocument<AlertEvent>;

export const AlertEventModel =
  (mongoose.models.AlertEvent as mongoose.Model<AlertEvent>) ??
  mongoose.model<AlertEvent>("AlertEvent", alertEventSchema);
