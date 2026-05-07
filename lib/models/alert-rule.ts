import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

const alertRuleSchema = new Schema(
  {
    pipelineId: { type: Schema.Types.ObjectId, ref: "Pipeline", required: true },
    name: { type: String, required: true },
    condition: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

alertRuleSchema.index({ pipelineId: 1 });

export type AlertRule = InferSchemaType<typeof alertRuleSchema>;
export type AlertRuleDoc = HydratedDocument<AlertRule>;

export const AlertRuleModel =
  (mongoose.models.AlertRule as mongoose.Model<AlertRule>) ??
  mongoose.model<AlertRule>("AlertRule", alertRuleSchema);
