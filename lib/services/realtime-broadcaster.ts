import { systemClock, type Clock } from "../clock";
import { materialize, type RunForMaterialization, type MaterializedSnapshot } from "./run-progress-tracker";

const TICK_INTERVAL_MS = 1500;

export class RealtimeBroadcaster {
  constructor(private readonly clock: Clock = systemClock) {}

  async stream(
    run: RunForMaterialization,
    emit: (snapshot: MaterializedSnapshot) => void,
    signal?: AbortSignal,
  ): Promise<MaterializedSnapshot> {
    let lastSnapshot = materialize(run, this.clock.now());
    emit(lastSnapshot);

    while (lastSnapshot.status === "running" && !signal?.aborted) {
      await this.sleep(TICK_INTERVAL_MS, signal);
      if (signal?.aborted) break;
      lastSnapshot = materialize(run, this.clock.now());
      emit(lastSnapshot);
    }

    return lastSnapshot;
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
}

export const realtimeBroadcaster = new RealtimeBroadcaster();
