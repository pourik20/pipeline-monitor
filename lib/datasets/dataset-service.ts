import type { UserDoc } from "@/lib/shared/user";
import { ConflictError, NotFoundError } from "@/lib/shared/errors";
import type { CreateDatasetInput, DatasetDto } from "@/lib/datasets/dataset-schema";
import { datasetRepository } from "@/lib/datasets/dataset-repository";
import type { DatasetDoc } from "@/lib/datasets/dataset-model";

function toDto(doc: DatasetDoc): DatasetDto {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? "",
    owner: String(doc.owner),
    createdBy: String(doc.createdBy),
    schemaVersion: doc.schemaVersion,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
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
