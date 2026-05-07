import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { DatasetModel, type DatasetDoc } from "../models/dataset";
import type { UserDoc } from "../models/user";
import { ConflictError, NotFoundError } from "../errors";
import type { CreateDatasetInput, DatasetDto } from "../schemas/dataset";

function toDto(doc: DatasetDoc): DatasetDto {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? "",
    owner: String(doc.owner),
    createdBy: String(doc.createdBy),
    schemaVersion: doc.schemaVersion,
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt.toISOString(),
  };
}

export const datasetService = {
  async create(input: CreateDatasetInput, currentUser: UserDoc): Promise<DatasetDto> {
    await connectToDatabase();
    try {
      const doc = await DatasetModel.create({
        name: input.name,
        description: input.description ?? "",
        owner: currentUser._id,
        createdBy: currentUser._id,
        schemaVersion: 1,
      });
      return toDto(doc);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
        throw new ConflictError(`Dataset with name "${input.name}" already exists`);
      }
      throw err;
    }
  },

  async list(): Promise<DatasetDto[]> {
    await connectToDatabase();
    const docs = await DatasetModel.find().sort({ createdAt: -1 });
    return docs.map(toDto);
  },

  async deleteById(id: string): Promise<void> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError(`Dataset ${id} not found`);
    }
    const res = await DatasetModel.deleteOne({ _id: id });
    if (res.deletedCount === 0) throw new NotFoundError(`Dataset ${id} not found`);
  },

  async getById(id: string): Promise<DatasetDto> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError(`Dataset ${id} not found`);
    }
    const doc = await DatasetModel.findById(id);
    if (!doc) throw new NotFoundError(`Dataset ${id} not found`);
    return toDto(doc);
  },
};
