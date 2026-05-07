import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { PipelineVersionModel, type PipelineVersionDoc } from "../models/pipeline-version";

export const pipelineVersionRepository = {
  async getLastVersionNumber(pipelineId: string | mongoose.Types.ObjectId): Promise<number> {
    await connectToDatabase();
    const last = await PipelineVersionModel.findOne({ pipelineId: new mongoose.Types.ObjectId(pipelineId) })
      .sort({ version: -1 })
      .select({ version: 1 });
    return last?.version ?? 0;
  },

  async create(data: {
    pipelineId: mongoose.Types.ObjectId | string;
    version: number;
    active: boolean;
    config: any;
    createdBy: mongoose.Types.ObjectId | string;
  }): Promise<PipelineVersionDoc> {
    await connectToDatabase();
    return PipelineVersionModel.create(data);
  },

  async findAllByPipelineId(pipelineId: string): Promise<PipelineVersionDoc[]> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(pipelineId)) return [];
    return PipelineVersionModel.find({
      pipelineId: new mongoose.Types.ObjectId(pipelineId),
    }).sort({ version: -1 });
  },

  async getActive(pipelineId: string): Promise<PipelineVersionDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(pipelineId)) return null;
    return PipelineVersionModel.findOne({
      pipelineId: new mongoose.Types.ObjectId(pipelineId),
      active: true,
    });
  },

  async findByIdAndPipelineId(versionId: string, pipelineId: string | mongoose.Types.ObjectId): Promise<PipelineVersionDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(versionId) || !mongoose.isValidObjectId(pipelineId)) return null;
    return PipelineVersionModel.findOne({
      _id: new mongoose.Types.ObjectId(versionId),
      pipelineId: new mongoose.Types.ObjectId(pipelineId),
    });
  },

  async deactivateCurrentActive(pipelineId: string | mongoose.Types.ObjectId): Promise<void> {
    await connectToDatabase();
    const currentActive = await PipelineVersionModel.findOne({
      pipelineId: new mongoose.Types.ObjectId(pipelineId),
      active: true,
    });
    if (currentActive) {
      await PipelineVersionModel.updateOne(
        { _id: currentActive._id, active: true },
        { $set: { active: false } },
      );
    }
  },

  async activateVersion(versionId: string, pipelineId: string | mongoose.Types.ObjectId): Promise<PipelineVersionDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(versionId) || !mongoose.isValidObjectId(pipelineId)) return null;
    return PipelineVersionModel.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(versionId), pipelineId: new mongoose.Types.ObjectId(pipelineId) },
      { $set: { active: true } },
      { returnDocument: "after" },
    );
  }
};
