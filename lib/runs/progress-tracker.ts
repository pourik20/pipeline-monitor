import type { RunStatus } from "@/lib/runs/run-state";

export interface PlanStep {
  name: string;
  order: number;
  durationMs: number;
  recordsTarget: number;
}

export interface Plan {
  steps: PlanStep[];
  willFail: boolean;
  failAtStepIndex: number | null;
}

export interface RunForMaterialization {
  id: string;
  startedAt: Date | null;
  status: RunStatus;
  recordsProcessed: number;
  finishedAt: Date | null;
  errorMessage: string | null;
  plan: Plan;
}

export interface MaterializedStepState {
  order: number;
  name: string;
  status: "pending" | "running" | "success" | "failed";
  recordsProcessed: number;
  progress: number;
}

export interface MaterializedSnapshot {
  runId: string;
  status: RunStatus;
  currentStepIndex: number | null;
  currentStepProgress: number;
  recordsProcessed: number;
  steps: MaterializedStepState[];
  finishedAt: string | null;
  errorMessage: string | null;
}

export function materialize(run: RunForMaterialization, now: Date): MaterializedSnapshot {
  const { plan } = run;
  const planSteps = [...plan.steps].sort((a, b) => a.order - b.order);

  if (run.status === "success" || run.status === "failed") {
    return {
      runId: run.id,
      status: run.status,
      currentStepIndex: null,
      currentStepProgress: 0,
      recordsProcessed: run.recordsProcessed,
      steps: reconstructTerminalSteps(planSteps, run.status, plan.failAtStepIndex),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      errorMessage: run.errorMessage,
    };
  }

  if (run.status === "pending" || !run.startedAt) {
    return {
      runId: run.id,
      status: "pending",
      currentStepIndex: null,
      currentStepProgress: 0,
      recordsProcessed: 0,
      steps: planSteps.map((s) => ({
        order: s.order,
        name: s.name,
        status: "pending",
        recordsProcessed: 0,
        progress: 0,
      })),
      finishedAt: null,
      errorMessage: null,
    };
  }

  const elapsed = now.getTime() - run.startedAt.getTime();

  let cumulativeTime = 0;
  const stepWindows = planSteps.map((s) => {
    const start = cumulativeTime;
    cumulativeTime += s.durationMs;
    return { start, end: cumulativeTime };
  });
  const totalDuration = cumulativeTime;

  let recordsProcessed = 0;
  let currentStepIndex: number | null = null;
  let currentStepProgress = 0;

  let alreadyFailed = false;
  const materializedSteps: MaterializedStepState[] = planSteps.map((step, i) => {
    const window = stepWindows[i];
    const isFailStep = plan.willFail && i === plan.failAtStepIndex;

    if (alreadyFailed || elapsed < window.start) {
      return { order: step.order, name: step.name, status: "pending", recordsProcessed: 0, progress: 0 };
    }

    if (elapsed >= window.end) {
      if (isFailStep) {
        alreadyFailed = true;
        return { order: step.order, name: step.name, status: "failed", recordsProcessed: 0, progress: 1 };
      }
      recordsProcessed += step.recordsTarget;
      return { order: step.order, name: step.name, status: "success", recordsProcessed: step.recordsTarget, progress: 1 };
    }

    const stepElapsed = elapsed - window.start;
    const progress = step.durationMs > 0 ? Math.min(1, stepElapsed / step.durationMs) : 1;
    const stepRecords = isFailStep ? 0 : Math.floor(step.recordsTarget * progress);

    currentStepIndex = i;
    currentStepProgress = progress;
    recordsProcessed += stepRecords;

    return { order: step.order, name: step.name, status: "running", recordsProcessed: stepRecords, progress };
  });

  const hasFailedStep = materializedSteps.some((s) => s.status === "failed");
  let finalStatus: RunStatus = "running";

  if (hasFailedStep) {
    finalStatus = "failed";
    currentStepIndex = null;
    currentStepProgress = 0;
  } else if (planSteps.length === 0 || elapsed >= totalDuration) {
    finalStatus = "success";
    currentStepIndex = null;
    currentStepProgress = 0;
    recordsProcessed = planSteps.reduce((sum, s) => sum + s.recordsTarget, 0);
  }

  return {
    runId: run.id,
    status: finalStatus,
    currentStepIndex,
    currentStepProgress,
    recordsProcessed,
    steps: materializedSteps,
    finishedAt: null,
    errorMessage: hasFailedStep ? "Pipeline execution failed" : null,
  };
}

function reconstructTerminalSteps(
  steps: PlanStep[],
  status: "success" | "failed",
  failAtStepIndex: number | null,
): MaterializedStepState[] {
  return steps.map((s, i) => {
    if (status === "success") {
      return { order: s.order, name: s.name, status: "success", recordsProcessed: s.recordsTarget, progress: 1 };
    }
    if (failAtStepIndex === null || i < failAtStepIndex) {
      return { order: s.order, name: s.name, status: "success", recordsProcessed: s.recordsTarget, progress: 1 };
    }
    if (i === failAtStepIndex) {
      return { order: s.order, name: s.name, status: "failed", recordsProcessed: 0, progress: 1 };
    }
    return { order: s.order, name: s.name, status: "pending", recordsProcessed: 0, progress: 0 };
  });
}
