import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

const planStepSchema = new Schema(
  {
    name: { type: String, required: true },
    order: { type: Number, required: true, min: 0 },
    durationMs: { type: Number, required: true, min: 0 },
    recordsTarget: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const planSchema = new Schema(
  {
    steps: { type: [planStepSchema], required: true, default: [] },
    willFail: { type: Boolean, required: true, default: false },
    failAtStepIndex: { type: Number, required: false, default: null },
  },
  { _id: false },
);

export const JOB_RUN_STATUSES = ["pending", "running", "success", "failed"] as const;
export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

const jobRunSchema = new Schema(
  {
    pipelineId: { type: Schema.Types.ObjectId, ref: "Pipeline", required: true },
    pipelineVersionId: {
      type: Schema.Types.ObjectId,
      ref: "PipelineVersion",
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: JOB_RUN_STATUSES,
      default: "pending",
    },
    startedAt: { type: Date, required: false, default: null },
    finishedAt: { type: Date, required: false, default: null },
    recordsProcessed: { type: Number, required: true, default: 0, min: 0 },
    errorMessage: { type: String, required: false, default: null },
    plan: { type: planSchema, required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

jobRunSchema.index({ pipelineId: 1, startedAt: -1 });
jobRunSchema.index({ status: 1, startedAt: -1 });
jobRunSchema.index({ pipelineVersionId: 1 });

export type JobRun = InferSchemaType<typeof jobRunSchema>;
export type JobRunDoc = HydratedDocument<JobRun>;

export const JobRunModel =
  (mongoose.models.JobRun as mongoose.Model<JobRun>) ??
  mongoose.model<JobRun>("JobRun", jobRunSchema);
