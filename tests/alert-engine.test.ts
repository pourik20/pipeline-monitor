import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { alertEngine } from "@/lib/services/alert-engine";
import type { AlertRuleDoc } from "@/lib/models/alert-rule";

function makeRule(
  overrides: Partial<{ condition: string; enabled: boolean; updatedAt: Date }> = {},
): AlertRuleDoc {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id,
    pipelineId: new mongoose.Types.ObjectId(),
    name: "test rule",
    condition: overrides.condition ?? "status = 'failed'",
    enabled: overrides.enabled ?? true,
    createdBy: "user1",
    createdAt: new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  } as unknown as AlertRuleDoc;
}

function makeRun(
  overrides: Partial<{
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    recordsProcessed: number;
    errorMessage: string | null;
    steps: Array<{ name: string; order: number; status: string; recordsProcessed: number }>;
  }> = {},
) {
  const startedAt = overrides.startedAt ?? new Date("2024-01-01T00:00:00Z");
  const finishedAt =
    overrides.finishedAt !== undefined
      ? overrides.finishedAt
      : new Date("2024-01-01T00:10:00Z");
  return {
    _id: new mongoose.Types.ObjectId(),
    pipelineId: new mongoose.Types.ObjectId(),
    pipelineVersionId: new mongoose.Types.ObjectId(),
    status: overrides.status ?? "failed",
    startedAt,
    finishedAt,
    recordsProcessed: overrides.recordsProcessed ?? 0,
    errorMessage: overrides.errorMessage ?? null,
    steps: overrides.steps ?? [],
  };
}

describe("alertEngine.evaluate", () => {
  it("matches a simple status comparison", async () => {
    const rule = makeRule({ condition: "status = 'failed'" });
    const run = makeRun({ status: "failed" });
    const matches = await alertEngine.evaluate([rule], run);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(rule);
  });

  it("does not match when condition is false", async () => {
    const rule = makeRule({ condition: "status = 'failed'" });
    const run = makeRun({ status: "success" });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(0);
  });

  it("matches runtime comparison", async () => {
    const startedAt = new Date("2024-01-01T00:00:00Z");
    const finishedAt = new Date("2024-01-01T00:15:00Z"); // 900000 ms
    const rule = makeRule({ condition: "runtime > 600000" });
    const run = makeRun({ status: "success", startedAt, finishedAt });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(1);
  });

  it("does not match runtime when under threshold", async () => {
    const startedAt = new Date("2024-01-01T00:00:00Z");
    const finishedAt = new Date("2024-01-01T00:05:00Z"); // 300000 ms
    const rule = makeRule({ condition: "runtime > 600000" });
    const run = makeRun({ status: "success", startedAt, finishedAt });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(0);
  });

  it("matches boolean combinations", async () => {
    const rule = makeRule({ condition: "status = 'failed' and recordsProcessed < 1000" });
    const run = makeRun({ status: "failed", recordsProcessed: 500 });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(1);
  });

  it("does not match when one side of 'and' is false", async () => {
    const rule = makeRule({ condition: "status = 'failed' and recordsProcessed < 1000" });
    const run = makeRun({ status: "success", recordsProcessed: 500 });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(0);
  });

  it("matches expressions referencing steps array", async () => {
    const rule = makeRule({ condition: "$count(steps[status = 'failed']) > 0" });
    const run = makeRun({
      steps: [
        { name: "extract", order: 0, status: "success", recordsProcessed: 1000 },
        { name: "transform", order: 1, status: "failed", recordsProcessed: 0 },
      ],
    });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(1);
  });

  it("skips disabled rules", async () => {
    const rule = makeRule({ condition: "status = 'failed'", enabled: false });
    const run = makeRun({ status: "failed" });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(0);
  });

  it("skips rules with malformed JSONata at compile time (parse failure)", async () => {
    const rule = makeRule({ condition: "!!invalid!!" });
    const run = makeRun({ status: "failed" });
    expect(await alertEngine.evaluate([rule], run)).toHaveLength(0);
  });

  it("treats runtime evaluation errors as false and continues other rules", async () => {
    const badRule = makeRule({ condition: "$sum(status)" }); // type error at runtime
    const goodRule = makeRule({ condition: "status = 'failed'" });
    const run = makeRun({ status: "failed" });
    const matches = await alertEngine.evaluate([badRule, goodRule], run);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(goodRule);
  });

  it("returns matched rules in input order", async () => {
    const r1 = makeRule({ condition: "status = 'failed'" });
    const r2 = makeRule({ condition: "recordsProcessed = 0" });
    const run = makeRun({ status: "failed", recordsProcessed: 0 });
    const matches = await alertEngine.evaluate([r1, r2], run);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toBe(r1);
    expect(matches[1]).toBe(r2);
  });

  it("uses expression cache (recompile on updatedAt change)", async () => {
    const updatedAt1 = new Date("2024-01-01T00:00:00Z");
    const rule1 = makeRule({ condition: "status = 'failed'", updatedAt: updatedAt1 });
    const run = makeRun({ status: "failed" });

    await alertEngine.evaluate([rule1], run);
    await alertEngine.evaluate([rule1], run); // should hit cache

    // Different updatedAt = different cache key
    const updatedAt2 = new Date("2024-01-02T00:00:00Z");
    const rule2 = { ...rule1, condition: "status = 'success'", updatedAt: updatedAt2 } as AlertRuleDoc;
    expect(await alertEngine.evaluate([rule2], run)).toHaveLength(0);
  });
});
