import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

const simulationStepSchema = new Schema(
  {
    name: { type: String, required: true },
    minDurationMs: { type: Number, required: true, min: 0 },
    maxDurationMs: { type: Number, required: true, min: 0 },
    recordsTarget: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const simulationSchema = new Schema(
  {
    steps: { type: [simulationStepSchema], required: true, default: [] },
    failureRate: { type: Number, required: true, min: 0, max: 1, default: 0 },
  },
  { _id: false },
);

const pipelineVersionConfigSchema = new Schema(
  {
    engine: { type: String, required: true },
    query: { type: String, required: true, default: "" },
    simulation: { type: simulationSchema, required: true },
  },
  { _id: false },
);

const pipelineVersionSchema = new Schema(
  {
    pipelineId: { type: Schema.Types.ObjectId, ref: "Pipeline", required: true },
    version: { type: Number, required: true, min: 1 },
    active: { type: Boolean, required: true, default: false },
    config: { type: pipelineVersionConfigSchema, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

pipelineVersionSchema.index({ pipelineId: 1, version: 1 }, { unique: true });
pipelineVersionSchema.index(
  { pipelineId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export type PipelineVersion = InferSchemaType<typeof pipelineVersionSchema>;
export type PipelineVersionDoc = HydratedDocument<PipelineVersion>;

export const PipelineVersionModel =
  (mongoose.models.PipelineVersion as mongoose.Model<PipelineVersion>) ??
  mongoose.model<PipelineVersion>("PipelineVersion", pipelineVersionSchema);
