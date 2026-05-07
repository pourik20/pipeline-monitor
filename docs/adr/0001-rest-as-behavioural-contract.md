# ADR-0001: REST API as the single behavioural contract

- **Status**: Accepted
- **Date**: 2026-05-07

## Context

The application is a fullstack Next.js 16 monolit (App Router). Next.js offers
multiple ways to mutate state from the UI:

- **Server Actions** — co-located TypeScript functions invoked from forms and
  client components.
- **Route Handlers** (`app/api/...`) — REST endpoints over `fetch`.
- **Direct service calls from React Server Components** — server-only reads.

Mixing all three creates two parallel behavioural contracts (Server Actions
*and* REST), which fragments concerns: validation, error mapping, logging,
authorization, and observability would have to be implemented twice. It also
makes the system harder to reason about for an external consumer (the
assignment is to demonstrate the architecture of a backend, not to
demonstrate Next.js framework features).

## Decision

The REST API exposed under `/api/*` is the **single behavioural contract** of
the system. Every state-changing operation goes through it.

Specifically:

1. **All mutations** — from any client component or external caller — go
   through `fetch('/api/...')`. Server Actions are not used.
2. **Reads from RSC pages** call domain services directly on the server. They
   do not loop back through HTTP. The domain layer is HTTP-agnostic; the same
   service powers both the REST handler and the RSC page.
3. **Cross-cutting concerns** (validation via Zod, error → status mapping via
   `withErrorHandling`, logging, `AuthContext` stamping) live exclusively in
   the route handler layer. Services never produce HTTP responses.
4. **Domain errors** (`ValidationError`, `NotFoundError`, `ConflictError`,
   `BusinessRuleError`, `ForbiddenError`) are the only mechanism services use
   to signal failure. The route layer maps them to status codes and the
   `{error: {code, message, details?}}` body shape.

## Consequences

**Positive**

- One contract to test, document, and observe.
- Clean separation: services are pure domain code, route handlers are the
  HTTP adapter.
- An external API client (curl, Postman, another service) can drive the
  system end-to-end without going through the UI.
- RSC pages stay fast — no extra HTTP round-trip for reads.

**Negative**

- We give up Server Actions' progressive-enhancement story (forms that work
  without JS). Acceptable given the project is an internal monitoring tool.
- Client mutations need a small amount of boilerplate (`fetch` + error
  handling + `router.refresh()`) compared to a Server Action call. Acceptable
  and consistent.

**Follow-ups**

- All future slices add their behaviour to the REST surface and reuse
  `withErrorHandling` rather than introducing alternative mutation paths.
