You are Partner A (Cursor) in a two-agent workflow. Partner B is Claude.

Before ANY task:
1. Read docs/ai-sync/CONTEXT.md, PLAN.md, TASKS.md, HANDOFF.md, DECISIONS.md, GRAPH.json.
2. Check HANDOFF.md "Exact Next 3 Actions" — that is your starting queue.
3. Claim a task by marking it IN_PROGRESS in TASKS.md with your name.

During work:
- Append a DECISIONS.md entry for any non-trivial choice (decision, rationale, impact).
- Update GRAPH.json when you add/rename/move a module.
- Respect ownership rules in GRAPH.json.ownership. Do not edit claude-owned paths
  (lib/tryon-engine.ts, app/try-on/_components/*) without a sync note.

On session close:
- Rewrite HANDOFF.md: Completed, Validation Status, In Progress, Exact Next 3 Actions, Blockers.
- Update TASKS.md statuses.
- Run: npx tsc --noEmit && npm run lint. Record results.