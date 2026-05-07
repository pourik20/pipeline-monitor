# ADR-0004: JSONata as the alert condition language

**Status**: Accepted  
**Date**: 2026-05-07

## Context

Alert rules need a user-facing condition expression that can reference run context fields (status, runtime, recordsProcessed, steps, etc.) and return a boolean. The two main options were:

1. **Custom DSL** — a minimal, hand-rolled expression parser (e.g. `status == 'failed' AND runtime > 600000`).
2. **Off-the-shelf expression language** — embed an existing library such as JSONata, cel-js, or a JSON-Logic evaluator.

A custom DSL avoids an external dependency but requires ongoing maintenance of the parser, error messages, and operator coverage. JSONata is a battle-tested, standards-adjacent query language designed specifically for JSON documents; its expressions work directly over JavaScript objects, which matches the run context shape exactly.

## Decision

Use **JSONata** (`jsonata` npm package) as the condition expression language for alert rules.

- Condition strings are validated at rule-creation time by calling `jsonata(condition)` and returning HTTP 400 with the parse error on failure.
- At evaluation time, `AlertEngine` compiles each rule's expression once and caches the compiled form keyed by `(rule._id, rule.updatedAt)` to avoid recompilation on every run finalization.
- Per-rule runtime errors are caught, logged via `Logger`, and treated as `false`; a single bad rule cannot interrupt evaluation of the remaining rules or prevent the terminal run state from being persisted.

## Consequences

**Positive**
- Rich query capabilities out of the box: comparisons, boolean logic, aggregation over `steps[]`, string matching, arithmetic.
- Compact dependency: `jsonata` has no runtime sub-dependencies beyond its own transitive set.
- Validation at create time gives users immediate, readable feedback before a rule fires in production.

**Negative**
- JSONata's expression syntax (e.g. `$count(...)`, `$sum(...)`) is not standard JavaScript and requires user familiarity.
- Async JSONata expressions (using `$$` or async callbacks) are unsupported in this implementation; the engine detects and skips them safely.
- The compiled-expression cache grows unbounded over the process lifetime; this is acceptable given the expected low cardinality of alert rules per deployment.
