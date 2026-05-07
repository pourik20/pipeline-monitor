import { describe, it, expect } from "vitest";
import { samplePlan, type SimulationConfig } from "@/lib/domain/plan-sampler";

const baseConfig: SimulationConfig = {
  steps: [
    { name: "extract", minDurationMs: 100, maxDurationMs: 500, recordsTarget: 1000 },
    { name: "transform", minDurationMs: 200, maxDurationMs: 800, recordsTarget: 800 },
    { name: "load", minDurationMs: 50, maxDurationMs: 250, recordsTarget: 800 },
  ],
  failureRate: 0,
};

describe("samplePlan", () => {
  it("is deterministic for a fixed seed", () => {
    const a = samplePlan(baseConfig, "seed-1");
    const b = samplePlan(baseConfig, "seed-1");
    expect(a).toEqual(b);
  });

  it("produces different plans for different seeds", () => {
    const a = samplePlan(baseConfig, "seed-1");
    const b = samplePlan(baseConfig, "seed-2");
    expect(a).not.toEqual(b);
  });

  it("durations fall within configured bounds", () => {
    for (let i = 0; i < 100; i++) {
      const plan = samplePlan(baseConfig, `seed-${i}`);
      plan.steps.forEach((s, idx) => {
        const cfg = baseConfig.steps[idx];
        expect(s.durationMs).toBeGreaterThanOrEqual(cfg.minDurationMs);
        expect(s.durationMs).toBeLessThanOrEqual(cfg.maxDurationMs);
      });
    }
  });

  it("respects step order and recordsTarget", () => {
    const plan = samplePlan(baseConfig, "seed-x");
    expect(plan.steps.map((s) => s.name)).toEqual(["extract", "transform", "load"]);
    expect(plan.steps.map((s) => s.order)).toEqual([0, 1, 2]);
    expect(plan.steps.map((s) => s.recordsTarget)).toEqual([1000, 800, 800]);
  });

  it("failureRate=0 never produces willFail=true", () => {
    for (let i = 0; i < 200; i++) {
      const plan = samplePlan({ ...baseConfig, failureRate: 0 }, `seed-${i}`);
      expect(plan.willFail).toBe(false);
      expect(plan.failAtStepIndex).toBeNull();
    }
  });

  it("failureRate=1 always produces willFail=true with a valid failAtStepIndex", () => {
    for (let i = 0; i < 200; i++) {
      const plan = samplePlan({ ...baseConfig, failureRate: 1 }, `seed-${i}`);
      expect(plan.willFail).toBe(true);
      expect(plan.failAtStepIndex).not.toBeNull();
      expect(plan.failAtStepIndex!).toBeGreaterThanOrEqual(0);
      expect(plan.failAtStepIndex!).toBeLessThan(baseConfig.steps.length);
    }
  });
});
