import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { DatasetModel, type DatasetDoc } from "../models/dataset";

export const datasetRepository = {
  async create(data: {
    name: string;
    description: string;
    owner: mongoose.Types.ObjectId | string;
    createdBy: mongoose.Types.ObjectId | string;
    schemaVersion: number;
  }): Promise<DatasetDoc> {
    await connectToDatabase();
    return DatasetModel.create(data);
  },

  async findAll(): Promise<DatasetDoc[]> {
    await connectToDatabase();
    return DatasetModel.find().sort({ createdAt: -1 });
  },

  async findById(id: string): Promise<DatasetDoc | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return null;
    return DatasetModel.findById(id);
  },

  async exists(id: string): Promise<boolean> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return false;
    return (await DatasetModel.exists({ _id: id })) !== null;
  },

  async deleteById(id: string): Promise<boolean> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await DatasetModel.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
