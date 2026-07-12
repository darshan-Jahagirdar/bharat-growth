# BharatGrowth Engineering Record

This directory is the canonical engineering and release record for BharatGrowth.
It documents what the application is expected to do, how structural changes are
verified, and how production changes are rolled out or reversed.

## Preserved baselines

| Purpose | Git reference | Notes |
|---|---|---|
| Production fallback before hardening | `pre-hardening-8c38909` | Points to the unchanged production `main` commit `8c38909`. |
| Local workspace safety checkpoint | `4b7424a` | Contains the reviewed intended workspace except machine-local Claude settings. It is not a production release. |
| Pre-decomposition baseline | Pending | Created only after hardening, migrations, CI, preview, and smoke checks pass. |
| Final decomposed release | Pending | Created only after every decomposition wave and full regression testing pass. |

At the checkpoint the repository contains 24,132 lines of TypeScript, TSX, and
CSS under `src/`, plus 7,938 lines of SQL under `supabase/`.

## Documents

- [Current architecture](architecture/CURRENT_ARCHITECTURE.md)
- [Behavior contracts](quality/BEHAVIOR_CONTRACTS.md)
- [Bug-fix status](quality/BUG_FIX_PLAN.md)
- [Production-quality checklist](quality/FIX_CHECKLIST.md)
- [Decomposition plan](quality/DECOMPOSITION_PLAN.md)
- [Decomposition log](quality/DECOMPOSITION_LOG.md)
- [Supabase migration runbook](database/MIGRATION_RUNBOOK.md)
- [Deployment and rollback](operations/DEPLOYMENT_AND_ROLLBACK.md)
- [Manual regression checklist](testing/MANUAL_REGRESSION_CHECKLIST.md)
- [Mac setup checklist](setup/MAC_MIGRATION_CHECKLIST.md)

The older files in `docs/` are retained as audit inputs. If they disagree with
this directory, update this directory and record the evidence in the
decomposition log.

## Non-negotiable gates

1. Never work directly on `main`.
2. Never push a file before checking it for credentials and machine-local data.
3. Never apply a Supabase migration before confirming the target project ref and
   reviewing a dry run.
4. Never combine an application dependency and its destructive/contract database
   change in one release step.
5. Never call a decomposition successful unless automated checks, preview smoke,
   and the relevant manual checklist pass.
6. Never announce production success in Slack while a required gate is failing.
