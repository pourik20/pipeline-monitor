import { BusinessRuleError } from "../errors";

export const RUN_STATUSES = ["pending", "running", "success", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

const ALLOWED: Record<RunStatus, ReadonlyArray<RunStatus>> = {
  pending: ["running"],
  running: ["success", "failed"],
  success: [],
  failed: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(
      `Illegal run state transition: ${from} → ${to}`,
    );
  }
}
