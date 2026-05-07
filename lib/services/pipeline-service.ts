import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { PipelineModel, type PipelineDoc } from "../models/pipeline";
import { DatasetModel } from "../models/dataset";
import type { UserDoc } from "../models/user";
import { BusinessRuleError, NotFoundError } from "../errors";
import type { CreatePipelineInput, PipelineDto } from "../schemas/pipeline";

function toDto(doc: PipelineDoc): PipelineDto {
  return {
    id: String(doc._id),
    datasetId: String(doc.datasetId),
    name: doc.name,
    description: doc.description ?? "",
    schedule: doc.schedule ?? "",
    active: doc.active,
    createdBy: String(doc.createdBy),
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt.toISOString(),
  };
}

export const pipelineService = {
  async create(input: CreatePipelineInput, currentUser: UserDoc): Promise<PipelineDto> {
    await connectToDatabase();

    if (!mongoose.isValidObjectId(input.datasetId)) {
      throw new BusinessRuleError(`Dataset ${input.datasetId} does not exist`);
    }
    const datasetExists = await DatasetModel.exists({ _id: input.datasetId });
    if (!datasetExists) {
      throw new BusinessRuleError(`Dataset ${input.datasetId} does not exist`);
    }

    const doc = await PipelineModel.create({
      datasetId: new mongoose.Types.ObjectId(input.datasetId),
      name: input.name,
      description: input.description ?? "",
      schedule: input.schedule ?? "",
      active: true,
      createdBy: currentUser._id,
    });
    return toDto(doc);
  },

  async list(): Promise<PipelineDto[]> {
    await connectToDatabase();
    const docs = await PipelineModel.find().sort({ createdAt: -1 });
    return docs.map(toDto);
  },

  async getById(id: string): Promise<PipelineDto> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError(`Pipeline ${id} not found`);
    }
    const doc = await PipelineModel.findById(id);
    if (!doc) throw new NotFoundError(`Pipeline ${id} not found`);
    return toDto(doc);
  },

  async requireById(id: string): Promise<PipelineDoc> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError(`Pipeline ${id} not found`);
    }
    const doc = await PipelineModel.findById(id);
    if (!doc) throw new NotFoundError(`Pipeline ${id} not found`);
    return doc;
  },
};
