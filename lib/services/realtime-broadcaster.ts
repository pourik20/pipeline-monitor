import { systemClock, type Clock } from '../clock'
import { materialize, type RunForMaterialization, type MaterializedSnapshot } from './run-progress-tracker'

const TICK_INTERVAL_MS = 1500

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

export interface RealtimeBroadcaster {
  stream(
    run: RunForMaterialization,
    emit: (snapshot: MaterializedSnapshot) => void,
    signal?: AbortSignal,
  ): Promise<MaterializedSnapshot>
}

export function createRealtimeBroadcaster(
  deps: { clock: Clock } = { clock: systemClock },
): RealtimeBroadcaster {
  const { clock } = deps

  return {
    async stream(run, emit, signal) {
      let lastSnapshot = materialize(run, clock.now())
      emit(lastSnapshot)

      while (lastSnapshot.status === 'running' && !signal?.aborted) {
        await sleep(TICK_INTERVAL_MS, signal)
        if (signal?.aborted) break
        lastSnapshot = materialize(run, clock.now())
        emit(lastSnapshot)
      }

      return lastSnapshot
    },
  }
}

export const realtimeBroadcaster = createRealtimeBroadcaster()
