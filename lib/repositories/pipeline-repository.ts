import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { PipelineModel, type PipelineDoc } from "../models/pipeline";

export const pipelineRepository = {
  async create(data: {
    datasetId: mongoose.Types.ObjectId | string;
    name: string;
    description: string;
    schedule: string;
    active: boolean;
    createdBy: mongoose.Types.ObjectId | string;
  }): Promise<PipelineDoc> {
    await connectToDatabase();
    return PipelineModel.create(data);
  },

  async findAll(): Promise<PipelineDoc[]> {
    await connectToDatabase();
    return PipelineModel.find().sort({ createdAt: -1 });
  },

  async findById(id: string): Promise<PipelineDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    return PipelineModel.findById(id);
  },

  async deleteById(id: string): Promise<boolean> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await PipelineModel.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
