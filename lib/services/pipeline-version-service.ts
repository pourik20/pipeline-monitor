import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import {
  PipelineVersionModel,
  type PipelineVersionDoc,
} from "../models/pipeline-version";
import { ConflictError, NotFoundError } from "../errors";
import type { UserDoc } from "../models/user";
import { pipelineService } from "./pipeline-service";
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
    await connectToDatabase();
    const pipeline = await pipelineService.requireById(pipelineId);

    const last = await PipelineVersionModel.findOne({ pipelineId: pipeline._id })
      .sort({ version: -1 })
      .select({ version: 1 });
    const nextVersion = (last?.version ?? 0) + 1;
    const isFirst = !last;

    try {
      const doc = await PipelineVersionModel.create({
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
    await connectToDatabase();
    await pipelineService.requireById(pipelineId);
    const docs = await PipelineVersionModel.find({
      pipelineId: new mongoose.Types.ObjectId(pipelineId),
    }).sort({ version: -1 });
    return docs.map(toDto);
  },

  async getActive(pipelineId: string): Promise<PipelineVersionDto | null> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(pipelineId)) return null;
    const doc = await PipelineVersionModel.findOne({
      pipelineId: new mongoose.Types.ObjectId(pipelineId),
      active: true,
    });
    return doc ? toDto(doc) : null;
  },

  async activate(
    pipelineId: string,
    versionId: string,
  ): Promise<PipelineVersionDto> {
    await connectToDatabase();
    const pipeline = await pipelineService.requireById(pipelineId);

    if (!mongoose.isValidObjectId(versionId)) {
      throw new NotFoundError(`Version ${versionId} not found in pipeline ${pipelineId}`);
    }

    const target = await PipelineVersionModel.findOne({
      _id: versionId,
      pipelineId: pipeline._id,
    });
    if (!target) {
      throw new NotFoundError(`Version ${versionId} not found in pipeline ${pipelineId}`);
    }

    if (target.active) {
      return toDto(target);
    }

    const currentActive = await PipelineVersionModel.findOne({
      pipelineId: pipeline._id,
      active: true,
    });

    if (currentActive) {
      await PipelineVersionModel.updateOne(
        { _id: currentActive._id, active: true },
        { $set: { active: false } },
      );
    }

    try {
      const updated = await PipelineVersionModel.findOneAndUpdate(
        { _id: target._id, pipelineId: pipeline._id },
        { $set: { active: true } },
        { returnDocument: "after" },
      );
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
