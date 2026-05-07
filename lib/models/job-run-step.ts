import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

export const JOB_RUN_STEP_STATUSES = [
  "pending",
  "running",
  "success",
  "failed",
] as const;
export type JobRunStepStatus = (typeof JOB_RUN_STEP_STATUSES)[number];

const jobRunStepSchema = new Schema(
  {
    runId: { type: Schema.Types.ObjectId, ref: "JobRun", required: true },
    order: { type: Number, required: true, min: 0 },
    name: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: JOB_RUN_STEP_STATUSES,
      default: "pending",
    },
    startedAt: { type: Date, required: false, default: null },
    finishedAt: { type: Date, required: false, default: null },
    recordsProcessed: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

jobRunStepSchema.index({ runId: 1, order: 1 });

export type JobRunStep = InferSchemaType<typeof jobRunStepSchema>;
export type JobRunStepDoc = HydratedDocument<JobRunStep>;

export const JobRunStepModel =
  (mongoose.models.JobRunStep as mongoose.Model<JobRunStep>) ??
  mongoose.model<JobRunStep>("JobRunStep", jobRunStepSchema);
