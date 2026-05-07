import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from "mongoose";

const datasetSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    schemaVersion: { type: Number, required: true, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export type Dataset = InferSchemaType<typeof datasetSchema>;
export type DatasetDoc = HydratedDocument<Dataset>;

export const DatasetModel =
  (mongoose.models.Dataset as mongoose.Model<Dataset>) ??
  mongoose.model<Dataset>("Dataset", datasetSchema);
