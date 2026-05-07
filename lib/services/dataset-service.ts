import type { UserDoc } from "../models/user";
import { ConflictError, NotFoundError } from "../errors";
import type { CreateDatasetInput, DatasetDto } from "../schemas/dataset";
import { datasetRepository } from "../repositories/dataset-repository";
import type { DatasetDoc } from "../models/dataset";

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
    try {
      const doc = await datasetRepository.create({
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
    const docs = await datasetRepository.findAll();
    return docs.map(toDto);
  },

  async deleteById(id: string): Promise<void> {
    const deleted = await datasetRepository.deleteById(id);
    if (!deleted) throw new NotFoundError(`Dataset ${id} not found`);
  },

  async getById(id: string): Promise<DatasetDto> {
    const doc = await datasetRepository.findById(id);
    if (!doc) throw new NotFoundError(`Dataset ${id} not found`);
    return toDto(doc);
  },
};
