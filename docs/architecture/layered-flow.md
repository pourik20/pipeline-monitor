# Layered request flow

How a single request travels from a client to MongoDB and back. Two entry
points share one core (ADR-0001).

```mermaid
flowchart LR
    UI["UI<br/>(React Server Components,<br/>client components)"]
    EXT["External client<br/>(curl, Postman, ...)"]

    subgraph entry["Entry layer"]
        ACT["lib/actions/*.ts<br/>'use server'<br/>returns ActionResult&lt;T&gt;"]
        API["app/api/.../route.ts<br/>withErrorHandling()<br/>returns Response"]
    end

    subgraph svc["Service layer (per bounded context)"]
        S["lib/{pipelines,runs,alerts,datasets}/*-service.ts<br/>orchestration, validation,<br/>throws DomainError"]
    end

    subgraph rep["Repository layer"]
        R["lib/{pipelines,runs,alerts,datasets}/*-repository.ts<br/>all Mongoose calls live here"]
    end

    DB[("MongoDB<br/>via lib/shared/mongodb.ts")]

    UI -->|form action / RSC call| ACT
    EXT -->|HTTP fetch| API
    ACT --> S
    API --> S
    S --> R
    R --> DB

    DB -.->|Doc| R
    R -.->|Doc| S
    S -.->|DTO| ACT
    S -.->|DTO| API
    ACT -.->|ActionResult| UI
    API -.->|JSON| EXT

    classDef entry fill:#e8f1ff,stroke:#3b82f6
    classDef svc fill:#fef3c7,stroke:#d97706
    classDef rep fill:#dcfce7,stroke:#16a34a
    classDef db fill:#f3e8ff,stroke:#7c3aed
    class ACT,API entry
    class S svc
    class R rep
    class DB db
```

## Why two entry points?

- **Server Actions** (`lib/actions/`) are optimal for the UI: no JSON
  roundtrip on form submits, native `revalidatePath` for cache busting, and
  `ActionResult<T>` shapes errors instead of throwing across the boundary.
- **REST routes** (`app/api/`) are the *behavioural contract* of the
  service. External clients depend on them; the assignment requires them.

Both are thin adapters. All domain logic — validation rules, error mapping,
business invariants — lives in services. This is enforced by `lib/shared/`
boundaries: `errors.ts`, `errors-to-result.ts`, and `with-error-handling.ts`
together ensure that whichever entry point is used, errors are normalized
identically.

## Server boundary

`lib/{pipelines,runs,alerts,datasets,events}/index.ts` and
`lib/shared/{mongodb,realtime}.ts` import `'server-only'`. This is a build-
time guard against accidentally bundling Mongoose or the event bus into a
client component.
