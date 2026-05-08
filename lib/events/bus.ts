import 'server-only'
import { logger } from '@/lib/shared/logger'
import type { DomainEvent, EventType, EventOf } from './types'

type Handler<T extends EventType> = (event: EventOf<T>) => void | Promise<void>

declare global {
  var __eventBus: Map<EventType, Set<Handler<EventType>>> | undefined
}

const handlers: Map<EventType, Set<Handler<EventType>>> =
  globalThis.__eventBus ?? new Map()
if (process.env.NODE_ENV !== 'production') globalThis.__eventBus = handlers

function getSet(type: EventType): Set<Handler<EventType>> {
  let set = handlers.get(type)
  if (!set) {
    set = new Set()
    handlers.set(type, set)
  }
  return set
}

export const bus = {
  on<T extends EventType>(type: T, handler: Handler<T>): () => void {
    const set = getSet(type)
    set.add(handler as unknown as Handler<EventType>)
    return () => set.delete(handler as unknown as Handler<EventType>)
  },

  publish(event: DomainEvent): void {
    const set = handlers.get(event.type)
    if (!set || set.size === 0) return
    for (const h of set) {
      Promise.resolve()
        .then(() => h(event as never))
        .catch((err) => logger.warn({ err, type: event.type }, 'event handler failed'))
    }
  },
}
