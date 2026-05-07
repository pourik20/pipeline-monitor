import { describe, it, expect } from "vitest";
import { FakeClock } from "@/lib/clock";
import { materialize, type RunForMaterialization } from "@/lib/services/run-progress-tracker";

const startedAt = new Date("2024-01-01T00:00:00.000Z");

const plan = {
  steps: [
    { name: "extract", order: 0, durationMs: 1000, recordsTarget: 100 },
    { name: "transform", order: 1, durationMs: 2000, recordsTarget: 200 },
    { name: "load", order: 2, durationMs: 1000, recordsTarget: 150 },
  ],
  willFail: false,
  failAtStepIndex: null,
};

const failingPlan = {
  ...plan,
  willFail: true,
  failAtStepIndex: 1,
};

function makeRun(overrides: Partial<RunForMaterialization> = {}): RunForMaterialization {
  return {
    id: "run-1",
    startedAt,
    status: "running",
    recordsProcessed: 0,
    finishedAt: null,
    errorMessage: null,
    plan,
    ...overrides,
  };
}

describe("materialize", () => {
  it("t=0: first step is running with ~0 progress", () => {
    const snap = materialize(makeRun(), startedAt);
    expect(snap.status).toBe("running");
    expect(snap.currentStepIndex).toBe(0);
    expect(snap.currentStepProgress).toBeCloseTo(0);
    expect(snap.recordsProcessed).toBe(0);
    expect(snap.steps[0].status).toBe("running");
    expect(snap.steps[1].status).toBe("pending");
    expect(snap.steps[2].status).toBe("pending");
  });

  it("mid-step-0: progress is proportional and records ramp", () => {
    const now = new Date(startedAt.getTime() + 500);
    const snap = materialize(makeRun(), now);
    expect(snap.status).toBe("running");
    expect(snap.currentStepIndex).toBe(0);
    expect(snap.currentStepProgress).toBeCloseTo(0.5);
    expect(snap.steps[0].status).toBe("running");
    expect(snap.steps[0].recordsProcessed).toBe(50);
  });

  it("between steps: step 0 done, step 1 just started", () => {
    const now = new Date(startedAt.getTime() + 1000);
    const snap = materialize(makeRun(), now);
    expect(snap.status).toBe("running");
    expect(snap.currentStepIndex).toBe(1);
    expect(snap.steps[0].status).toBe("success");
    expect(snap.steps[0].recordsProcessed).toBe(100);
    expect(snap.steps[1].status).toBe("running");
  });

  it("deep into final step: currentStepIndex=2, progress ~0.5", () => {
    const now = new Date(startedAt.getTime() + 3500);
    const snap = materialize(makeRun(), now);
    expect(snap.status).toBe("running");
    expect(snap.currentStepIndex).toBe(2);
    expect(snap.currentStepProgress).toBeCloseTo(0.5);
    expect(snap.steps[0].status).toBe("success");
    expect(snap.steps[1].status).toBe("success");
    expect(snap.steps[2].status).toBe("running");
  });

  it("just-after-terminal: all steps done, status=success, full records", () => {
    const now = new Date(startedAt.getTime() + 4001);
    const snap = materialize(makeRun(), now);
    expect(snap.status).toBe("success");
    expect(snap.currentStepIndex).toBeNull();
    expect(snap.recordsProcessed).toBe(450);
    expect(snap.steps.every((s) => s.status === "success")).toBe(true);
  });

  it("well-past-terminal: still returns success", () => {
    const now = new Date(startedAt.getTime() + 100_000);
    const snap = materialize(makeRun(), now);
    expect(snap.status).toBe("success");
    expect(snap.recordsProcessed).toBe(450);
  });

  describe("willFail=true (failAtStepIndex=1)", () => {
    it("mid-fail-step: step is still running", () => {
      const now = new Date(startedAt.getTime() + 1500);
      const snap = materialize(makeRun({ plan: failingPlan }), now);
      expect(snap.status).toBe("running");
      expect(snap.currentStepIndex).toBe(1);
      expect(snap.steps[0].status).toBe("success");
      expect(snap.steps[1].status).toBe("running");
    });

    it("fail-step records are always 0 while running", () => {
      const now = new Date(startedAt.getTime() + 1500);
      const snap = materialize(makeRun({ plan: failingPlan }), now);
      expect(snap.steps[1].recordsProcessed).toBe(0);
    });

    it("after fail-step completes: status=failed, step after is pending", () => {
      const now = new Date(startedAt.getTime() + 3001);
      const snap = materialize(makeRun({ plan: failingPlan }), now);
      expect(snap.status).toBe("failed");
      expect(snap.currentStepIndex).toBeNull();
      expect(snap.steps[1].status).toBe("failed");
      expect(snap.steps[1].recordsProcessed).toBe(0);
      expect(snap.steps[2].status).toBe("pending");
    });

    it("recordsProcessed only counts steps before the fail step", () => {
      const now = new Date(startedAt.getTime() + 3001);
      const snap = materialize(makeRun({ plan: failingPlan }), now);
      expect(snap.recordsProcessed).toBe(100);
    });
  });

  it("pending run: all steps pending, status=pending", () => {
    const snap = materialize(makeRun({ status: "pending", startedAt: null }), new Date());
    expect(snap.status).toBe("pending");
    expect(snap.steps.every((s) => s.status === "pending")).toBe(true);
    expect(snap.recordsProcessed).toBe(0);
  });

  it("already-terminal success: returns stored recordsProcessed and all steps success", () => {
    const snap = materialize(
      makeRun({ status: "success", recordsProcessed: 450, finishedAt: new Date() }),
      new Date(),
    );
    expect(snap.status).toBe("success");
    expect(snap.recordsProcessed).toBe(450);
    expect(snap.steps.every((s) => s.status === "success")).toBe(true);
  });

  it("already-terminal failed: reconstructs correct step statuses from plan", () => {
    const snap = materialize(
      makeRun({
        status: "failed",
        recordsProcessed: 100,
        finishedAt: new Date(),
        plan: failingPlan,
      }),
      new Date(),
    );
    expect(snap.status).toBe("failed");
    expect(snap.steps[0].status).toBe("success");
    expect(snap.steps[1].status).toBe("failed");
    expect(snap.steps[2].status).toBe("pending");
  });

  it("FakeClock can control time", () => {
    const clock = new FakeClock(startedAt);
    clock.advance(500);
    const snap = materialize(makeRun(), clock.now());
    expect(snap.currentStepIndex).toBe(0);
    expect(snap.currentStepProgress).toBeCloseTo(0.5);
  });
});
