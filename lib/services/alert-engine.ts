import jsonata from "jsonata";
import type mongoose from "mongoose";
import { logger } from "../logger";
import type { AlertRuleDoc } from "../models/alert-rule";

export interface AlertEvalContext {
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  recordsProcessed: number;
  errorMessage: string | null;
  runtime: number | null;
  pipelineId: string;
  pipelineVersionId: string;
  steps: Array<{
    name: string;
    order: number;
    status: string;
    recordsProcessed: number;
  }>;
}

export interface AlertRunInput {
  _id: mongoose.Types.ObjectId;
  pipelineId: mongoose.Types.ObjectId;
  pipelineVersionId: mongoose.Types.ObjectId;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  recordsProcessed: number;
  errorMessage: string | null;
  steps?: Array<{
    name: string;
    order: number;
    status: string;
    recordsProcessed: number;
  }>;
}

const compiledCache = new Map<string, ReturnType<typeof jsonata>>();

function getCacheKey(rule: AlertRuleDoc): string {
  return `${rule._id}:${(rule as AlertRuleDoc & { updatedAt?: Date }).updatedAt?.getTime() ?? 0}`;
}

function getCompiled(rule: AlertRuleDoc): ReturnType<typeof jsonata> | null {
  const key = getCacheKey(rule);
  if (compiledCache.has(key)) return compiledCache.get(key)!;
  try {
    const expr = jsonata(rule.condition);
    compiledCache.set(key, expr);
    return expr;
  } catch (err) {
    logger.warn({ ruleId: rule._id, condition: rule.condition, err }, "alert rule compile failed");
    return null;
  }
}

function buildContext(run: AlertRunInput): AlertEvalContext {
  const runtime =
    run.startedAt && run.finishedAt
      ? run.finishedAt.getTime() - run.startedAt.getTime()
      : null;
  return {
    status: run.status,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    recordsProcessed: run.recordsProcessed,
    errorMessage: run.errorMessage,
    runtime,
    pipelineId: String(run.pipelineId),
    pipelineVersionId: String(run.pipelineVersionId),
    steps: run.steps ?? [],
  };
}

export const alertEngine = {
  async evaluate(rules: AlertRuleDoc[], run: AlertRunInput): Promise<AlertRuleDoc[]> {
    const context = buildContext(run);
    const matched: AlertRuleDoc[] = [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const expr = getCompiled(rule);
      if (!expr) continue;

      try {
        const result = await expr.evaluate(context);
        if (result) matched.push(rule);
      } catch (err) {
        logger.warn({ ruleId: rule._id, err }, "alert rule evaluation error; treating as false");
      }
    }

    return matched;
  },
};
