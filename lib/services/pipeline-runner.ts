import mongoose from "mongoose";
import { connectToDatabase } from "../mongodb";
import { BusinessRuleError, NotFoundError } from "../errors";
import { systemClock, type Clock } from "../clock";
import { pipelineService } from "./pipeline-service";
import { PipelineVersionModel } from "../models/pipeline-version";
import { JobRunModel, type JobRunDoc } from "../models/job-run";
import { JobRunStepModel, type JobRunStepDoc } from "../models/job-run-step";
import { samplePlan } from "../domain/plan-sampler";
import { runRepository, type FindFilteredArgs } from "../repositories/run-repository";
import { materialize, type RunForMaterialization } from "./run-progress-tracker";
import { runFinalizer } from "./run-finalizer";
import {
  type JobRunDto,
  type JobRunStepDto,
  type RunDetailResponse,
  type RunDetailWithSnapshot,
} from "../schemas/run";

function runToDto(doc: JobRunDoc): JobRunDto {
  const created = (doc as unknown as { createdAt: Date }).createdAt;
  const updated = (doc as unknown as { updatedAt: Date }).updatedAt;
  return {
    id: String(doc._id),
    pipelineId: String(doc.pipelineId),
    pipelineVersionId: String(doc.pipelineVersionId),
    status: doc.status,
    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt).toISOString() : null,
    recordsProcessed: doc.recordsProcessed,
    errorMessage: doc.errorMessage ?? null,
    plan: {
      steps: doc.plan.steps.map((s) => ({
        name: s.name,
        order: s.order,
        durationMs: s.durationMs,
        recordsTarget: s.recordsTarget,
      })),
      willFail: doc.plan.willFail,
      failAtStepIndex:
        typeof doc.plan.failAtStepIndex === "number"
          ? doc.plan.failAtStepIndex
          : null,
    },
    createdAt: created.toISOString(),
    updatedAt: updated.toISOString(),
  };
}

function stepToDto(doc: JobRunStepDoc): JobRunStepDto {
  return {
    id: String(doc._id),
    runId: String(doc.runId),
    order: doc.order,
    name: doc.name,
    status: doc.status,
    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
    finishedAt: doc.finishedAt ? new Date(doc.finishedAt).toISOString() : null,
    recordsProcessed: doc.recordsProcessed,
  };
}

export class PipelineRunner {
  constructor(private readonly clock: Clock = systemClock) {}

  async start(pipelineId: string): Promise<JobRunDto> {
    await connectToDatabase();
    const pipeline = await pipelineService.requireById(pipelineId);

    if (!pipeline.active) {
      throw new BusinessRuleError(
        `Pipeline ${pipelineId} is not active`,
      );
    }

    const activeVersion = await PipelineVersionModel.findOne({
      pipelineId: pipeline._id,
      active: true,
    });
    if (!activeVersion) {
      throw new BusinessRuleError(
        `Pipeline ${pipelineId} has no active version`,
      );
    }

    const seed = `${String(activeVersion._id)}:${this.clock
      .now()
      .getTime()}:${Math.floor(Math.random() * 0xffffffff)}`;
    const plan = samplePlan(activeVersion.config.simulation, seed);

    const startedAt = this.clock.now();
    const run = await JobRunModel.create({
      pipelineId: pipeline._id,
      pipelineVersionId: activeVersion._id,
      status: "running",
      startedAt,
      finishedAt: null,
      recordsProcessed: 0,
      errorMessage: null,
      plan,
    });

    if (plan.steps.length > 0) {
      await JobRunStepModel.insertMany(
        plan.steps.map((s) => ({
          runId: run._id,
          order: s.order,
          name: s.name,
          status: "pending" as const,
          recordsProcessed: 0,
        })),
      );
    }

    return runToDto(run);
  }
}

export const pipelineRunner = new PipelineRunner();

export const runService = {
  async list(args: {
    pipelineId?: string;
    status?: FindFilteredArgs["status"];
    from?: string;
    to?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: JobRunDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await runRepository.findFiltered({
      pipelineId: args.pipelineId,
      status: args.status,
      from: args.from ? new Date(args.from) : undefined,
      to: args.to ? new Date(args.to) : undefined,
      limit: args.limit,
      cursor: args.cursor,
    });
    return { items: items.map(runToDto), nextCursor };
  },

  async getById(id: string): Promise<RunDetailWithSnapshot> {
    await connectToDatabase();
    if (!mongoose.isValidObjectId(id)) {
      throw new NotFoundError(`Run ${id} not found`);
    }
    const run = await JobRunModel.findById(id);
    if (!run) throw new NotFoundError(`Run ${id} not found`);

    const runForMat: RunForMaterialization = {
      id: String(run._id),
      startedAt: run.startedAt ? new Date(run.startedAt) : null,
      status: run.status,
      recordsProcessed: run.recordsProcessed,
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      errorMessage: run.errorMessage ?? null,
      plan: {
        steps: run.plan.steps.map((s) => ({
          name: s.name,
          order: s.order,
          durationMs: s.durationMs,
          recordsTarget: s.recordsTarget,
        })),
        willFail: run.plan.willFail,
        failAtStepIndex:
          typeof run.plan.failAtStepIndex === "number" ? run.plan.failAtStepIndex : null,
      },
    };

    const snapshot = materialize(runForMat, systemClock.now());

    if (run.status === "running" && (snapshot.status === "success" || snapshot.status === "failed")) {
      runFinalizer
        .finalize(run._id, "running", {
          reason: snapshot.status,
          errorMessage: snapshot.errorMessage ?? undefined,
          recordsProcessed: snapshot.recordsProcessed,
        })
        .catch(() => {});
    }

    const runDto = runToDto(run);
    runDto.status = snapshot.status;
    runDto.recordsProcessed = snapshot.recordsProcessed;
    if (snapshot.finishedAt) runDto.finishedAt = snapshot.finishedAt;
    if (snapshot.errorMessage) runDto.errorMessage = snapshot.errorMessage;

    return { run: runDto, snapshot };
  },
};
