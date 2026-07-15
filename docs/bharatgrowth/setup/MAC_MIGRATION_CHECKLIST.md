# Mac Setup Checklist

The detailed historical checklist remains at
[`docs/MAC_MIGRATION_CHECKLIST.md`](../../MAC_MIGRATION_CHECKLIST.md).

For production work, additionally verify:

- [ ] Read `docs/bharatgrowth/CODEX_HANDOFF.md` and every file in its required
  order before repository/service actions.
- [ ] Repository, product inventory, collaboration workflow, and handoff
  documentation are current.
- [ ] `.env.local` exists locally but is not tracked or printed.
- [ ] GitHub CLI is authenticated to the intended account.
- [ ] Supabase CLI is authenticated and the linked project ref is explicitly
  checked before every database command.
- [ ] Vercel project/team and environment target are explicit.
- [ ] `npm ci`, typecheck, lint, tests, and build pass.
- [ ] Local browser verification shows content, no framework overlay, and no
  blocking console error.
- [ ] Machine-local Claude settings remain uncommitted.
- [ ] `designs/`, `designs_mobile/`, and `docs/bharatgrowth/design/` remain
  user-owned, untracked, and excluded.
- [ ] Google Docs connector can read the exact shared handoff and Slack can read
  `#bharatgrowth`; do not perform test writes unless the task requires a real
  milestone.
- [ ] Re-derive remote `main` and integration, current PR/check state, linked
  staging Supabase ref/migrations, and exact-commit integration Vercel preview.
- [ ] A local stale integration pointer is not mistaken for the remote base.

See [`../COLLABORATION_WORKFLOW.md`](../COLLABORATION_WORKFLOW.md) for the exact
Google/Slack/GitHub/Vercel/Supabase operating sequence.
