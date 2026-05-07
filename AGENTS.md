<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `pourik20/pipeline-monitor`, accessed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Architectural conventions

- **Funkční doménová vrstva.** Služby v `lib/services/` jsou plain object exporty nebo factory funkce `createXService({ clock })`. Žádné `class XService` s `constructor(clock)`. Třídy jsou OK pouze pro error types (`DomainError`) a Clock implementace.
- **Dva vstupy do domény.** REST handlery (`app/api/.../route.ts`) pro externí klienty + Server Actions (`lib/actions/*.ts` s `'use server'`) pro UI. Oba kanály volají stejné `lib/services/`. Žádná logika v route handleru ani v action — jen Zod parse + service call.
- **Server boundary.** `lib/services/index.ts`, `lib/repositories/index.ts`, `lib/mongodb.ts` mají `import 'server-only'`. Nový kód v `lib/` musí být připraven, že může být jen na serveru.
- **ActionResult tvar.** Server Actions vrací `ActionResult<T> = { ok: true, data } | { ok: false, error: { code, message, details? } }`. Žádné throw přes hranici klient/server. Mapování chyb je v `lib/errors-to-result.ts`, sdílené s `withErrorHandling`.
