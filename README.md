# Pipeline Monitor

A school project (MSWA — Software Architecture) that simulates a data-pipeline orchestration / monitoring platform. The app catalogs datasets, pipelines and pipeline versions, runs (simulated) jobs end-to-end with real-time progress over Server-Sent Events, and raises alerts when JSONata conditions match against finished runs.

The architecture (and what's intentionally out of scope) is documented in [`BASE_PLAN.MD`](./BASE_PLAN.MD).

## Run locally

1. Create `.env.local` in the repo root with a MongoDB connection string:

   ```
   MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/pipeline-monitor?retryWrites=true&w=majority
   ```

2. Install dependencies, seed the database, and start the dev server:

   ```bash
   pnpm install
   pnpm seed
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000). The dashboard shows the seeded counts; the "Currently running" panel links to a run that is streaming live.

## Demo notes

- Pipeline runs are **simulated**, not real distributed compute. Plans are sampled at start time and progress is materialized lazily from `startedAt` + plan durations.
- The simulator caps any single run at **~45 s** of simulated runtime so demos finish promptly.
- `pnpm seed` is **idempotent** — it drops collections and recreates: 1 admin (`admin@demo`), 5 datasets, 6 pipelines (each with 1–2 versions), ~20 historical runs, 1 currently-running run for the SSE demo, 4 alert rules, and ~5 historical alert events.

## Tests

```bash
pnpm test
```
