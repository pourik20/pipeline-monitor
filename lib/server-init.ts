import 'server-only'

// Importing this module triggers registration of all event-bus subscribers.
// The actual wiring lives in each domain (currently only `alerts` subscribes).
// This file exists so that any code path that *publishes* events can do
// `import '@/lib/server-init'` to guarantee subscribers are registered,
// independently of whether `instrumentation.ts` already ran.

import '@/lib/alerts'
