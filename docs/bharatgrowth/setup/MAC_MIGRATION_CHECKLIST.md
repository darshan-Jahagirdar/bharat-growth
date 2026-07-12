# Mac Setup Checklist

The detailed historical checklist remains at
[`docs/MAC_MIGRATION_CHECKLIST.md`](../../MAC_MIGRATION_CHECKLIST.md).

For production work, additionally verify:

- [ ] Repository and handoff documentation are current.
- [ ] `.env.local` exists locally but is not tracked or printed.
- [ ] GitHub CLI is authenticated to the intended account.
- [ ] Supabase CLI is authenticated and the linked project ref is explicitly
  checked before every database command.
- [ ] Vercel project/team and environment target are explicit.
- [ ] `npm ci`, typecheck, lint, tests, and build pass.
- [ ] Local browser verification shows content, no framework overlay, and no
  blocking console error.
- [ ] Machine-local Claude settings remain uncommitted.
