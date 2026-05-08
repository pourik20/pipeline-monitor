import type { UserDoc } from "../models/user";
import { BusinessRuleError, NotFoundError } from "../errors";
import type { CreatePipelineInput, PipelineDto } from "../schemas/pipeline";
import { pipelineRepository } from "../repositories/pipeline-repository";
import { datasetRepository } from "../repositories/dataset-repository";
import type { PipelineDoc } from "../models/pipeline";

function toDto(doc: PipelineDoc): PipelineDto {
  return {
    id: String(doc._id),
    datasetId: String(doc.datasetId),
    name: doc.name,
    description: doc.description ?? "",
    schedule: doc.schedule ?? "",
    active: doc.active,
    createdBy: String(doc.createdBy),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const pipelineService = {
  async create(input: CreatePipelineInput, currentUser: UserDoc): Promise<PipelineDto> {
    const datasetExists = await datasetRepository.exists(input.datasetId);
    if (!datasetExists) {
      throw new BusinessRuleError(`Dataset ${input.datasetId} does not exist`);
    }

    const doc = await pipelineRepository.create({
      datasetId: input.datasetId,
      name: input.name,
      description: input.description ?? "",
      schedule: input.schedule ?? "",
      active: true,
      createdBy: currentUser._id,
    });
    return toDto(doc);
  },

  async list(): Promise<PipelineDto[]> {
    const docs = await pipelineRepository.findAll();
    return docs.map(toDto);
  },

  async getById(id: string): Promise<PipelineDto> {
    const doc = await pipelineRepository.findById(id);
    if (!doc) throw new NotFoundError(`Pipeline ${id} not found`);
    return toDto(doc);
  },

  async deleteById(id: string): Promise<void> {
    const deleted = await pipelineRepository.deleteById(id);
    if (!deleted) throw new NotFoundError(`Pipeline ${id} not found`);
  },

  async requireById(id: string): Promise<PipelineDoc> {
    const doc = await pipelineRepository.findById(id);
    if (!doc) throw new NotFoundError(`Pipeline ${id} not found`);
    return doc;
  },
};
