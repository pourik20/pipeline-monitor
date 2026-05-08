import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

const pipelineSchema = new Schema(
  {
    datasetId: { type: Schema.Types.ObjectId, ref: "Dataset", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    schedule: { type: String, default: "" },
    active: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

pipelineSchema.index({ datasetId: 1 });
pipelineSchema.index({ active: 1 });

export type Pipeline = InferSchemaType<typeof pipelineSchema>;
export type PipelineDoc = HydratedDocument<Pipeline>;

export const PipelineModel =
  (mongoose.models.Pipeline as mongoose.Model<Pipeline>) ??
  mongoose.model<Pipeline>("Pipeline", pipelineSchema);
