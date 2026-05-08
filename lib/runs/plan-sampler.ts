export interface SimulationStepConfig {
  name: string;
  minDurationMs: number;
  maxDurationMs: number;
  recordsTarget: number;
}

export interface SimulationConfig {
  steps: SimulationStepConfig[];
  failureRate: number;
}

export interface SampledPlanStep {
  name: string;
  order: number;
  durationMs: number;
  recordsTarget: number;
}

export interface SampledPlan {
  steps: SampledPlanStep[];
  willFail: boolean;
  failAtStepIndex: number | null;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toSeed(seed: number | string): number {
  return typeof seed === "number" ? seed >>> 0 : hashStringToSeed(seed);
}

export function samplePlan(
  config: SimulationConfig,
  seed: number | string,
): SampledPlan {
  const rng = mulberry32(toSeed(seed));

  const steps: SampledPlanStep[] = config.steps.map((step, index) => {
    const span = Math.max(0, step.maxDurationMs - step.minDurationMs);
    const durationMs = Math.floor(step.minDurationMs + rng() * (span + 1));
    return {
      name: step.name,
      order: index,
      durationMs: Math.min(step.maxDurationMs, durationMs),
      recordsTarget: step.recordsTarget,
    };
  });

  const failureRoll = rng();
  const willFail = failureRoll < config.failureRate;
  const failAtStepIndex =
    willFail && steps.length > 0
      ? Math.floor(rng() * steps.length)
      : null;

  const MAX_TOTAL_DURATION_MS = 45_000;
  const totalDuration = steps.reduce((sum, s) => sum + s.durationMs, 0);
  if (totalDuration > MAX_TOTAL_DURATION_MS) {
    const scale = MAX_TOTAL_DURATION_MS / totalDuration;
    return {
      steps: steps.map((s) => ({ ...s, durationMs: Math.max(1, Math.floor(s.durationMs * scale)) })),
      willFail,
      failAtStepIndex,
    };
  }

  return { steps, willFail, failAtStepIndex };
}
