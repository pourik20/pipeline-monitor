import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  RUN_STATUSES,
  type RunStatus,
} from "@/lib/runs/run-state";
import { BusinessRuleError } from "@/lib/shared/errors";

const LEGAL: Array<[RunStatus, RunStatus]> = [
  ["pending", "running"],
  ["running", "success"],
  ["running", "failed"],
];

describe("runState.canTransition", () => {
  it("allows legal transitions", () => {
    for (const [from, to] of LEGAL) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("rejects every other (from, to) pair", () => {
    const legalKeys = new Set(LEGAL.map(([f, t]) => `${f}->${t}`));
    for (const from of RUN_STATUSES) {
      for (const to of RUN_STATUSES) {
        if (legalKeys.has(`${from}->${to}`)) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it("rejects transitions out of terminal states", () => {
    for (const from of ["success", "failed"] as const) {
      for (const to of RUN_STATUSES) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

describe("runState.assertTransition", () => {
  it("does not throw for legal transitions", () => {
    for (const [from, to] of LEGAL) {
      expect(() => assertTransition(from, to)).not.toThrow();
    }
  });

  it("throws BusinessRuleError for illegal transitions", () => {
    expect(() => assertTransition("pending", "success")).toThrow(BusinessRuleError);
    expect(() => assertTransition("success", "running")).toThrow(BusinessRuleError);
    expect(() => assertTransition("failed", "pending")).toThrow(BusinessRuleError);
    expect(() => assertTransition("pending", "pending")).toThrow(BusinessRuleError);
  });
});
