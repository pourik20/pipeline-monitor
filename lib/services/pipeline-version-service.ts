import { ConflictError, NotFoundError } from "../errors";
import type { UserDoc } from "../models/user";
import { pipelineService } from "./pipeline-service";
import { pipelineVersionRepository } from "../repositories/pipeline-version-repository";
import type { PipelineVersionDoc } from "../models/pipeline-version";
import type {
  CreatePipelineVersionInput,
  PipelineVersionDto,
} from "../schemas/pipeline";

function toDto(doc: PipelineVersionDoc): PipelineVersionDto {
  const cfg = doc.config;
  return {
    id: String(doc._id),
    pipelineId: String(doc.pipelineId),
    version: doc.version,
    active: doc.active,
    config: {
      engine: cfg.engine,
      query: cfg.query ?? "",
      simulation: {
        steps: cfg.simulation.steps.map((s) => ({
          name: s.name,
          minDurationMs: s.minDurationMs,
          maxDurationMs: s.maxDurationMs,
          recordsTarget: s.recordsTarget,
        })),
        failureRate: cfg.simulation.failureRate,
      },
    },
    createdBy: String(doc.createdBy),
    createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
    updatedAt: (doc as unknown as { updatedAt: Date }).updatedAt.toISOString(),
  };
}

export const pipelineVersionService = {
  async create(
    pipelineId: string,
    input: CreatePipelineVersionInput,
    currentUser: UserDoc,
  ): Promise<PipelineVersionDto> {
    const pipeline = await pipelineService.requireById(pipelineId);

    const lastVersion = await pipelineVersionRepository.getLastVersionNumber(pipeline._id);
    const nextVersion = lastVersion + 1;
    const isFirst = lastVersion === 0;

    try {
      const doc = await pipelineVersionRepository.create({
        pipelineId: pipeline._id,
        version: nextVersion,
        active: isFirst,
        config: input.config,
        createdBy: currentUser._id,
      });
      return toDto(doc);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
        throw new ConflictError("Concurrent version creation conflict; please retry");
      }
      throw err;
    }
  },

  async list(pipelineId: string): Promise<PipelineVersionDto[]> {
    await pipelineService.requireById(pipelineId);
    const docs = await pipelineVersionRepository.findAllByPipelineId(pipelineId);
    return docs.map(toDto);
  },

  async getActive(pipelineId: string): Promise<PipelineVersionDto | null> {
    const doc = await pipelineVersionRepository.getActive(pipelineId);
    return doc ? toDto(doc) : null;
  },

  async activate(
    pipelineId: string,
    versionId: string,
  ): Promise<PipelineVersionDto> {
    const pipeline = await pipelineService.requireById(pipelineId);

    const target = await pipelineVersionRepository.findByIdAndPipelineId(versionId, pipeline._id);
    if (!target) {
      throw new NotFoundError(`Version ${versionId} not found in pipeline ${pipelineId}`);
    }

    if (target.active) {
      return toDto(target);
    }

    await pipelineVersionRepository.deactivateCurrentActive(pipeline._id);

    try {
      const updated = await pipelineVersionRepository.activateVersion(versionId, pipeline._id);
      if (!updated) {
        throw new NotFoundError(
          `Version ${versionId} not found in pipeline ${pipelineId}`,
        );
      }
      return toDto(updated);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
        throw new ConflictError(
          "Another version is already active for this pipeline",
        );
      }
      throw err;
    }
  },
};
