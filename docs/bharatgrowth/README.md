# BharatGrowth Engineering Record

This directory is the canonical engineering and release record for BharatGrowth.
It documents what the application is expected to do, how structural changes are
verified, and how production changes are rolled out or reversed.

## Current continuation state

- Production `main` remains unchanged at `8c38909`.
- Integration application checkpoint after Wave 5 is `907dfe3`.
- Waves 1–5 are merged only into integration; Wave 6 Storefront is next.
- Staging Supabase is `qokaaggeqahayxsybgds` with matching migrations 001–048.
- The authoritative exact handoff is [`CODEX_HANDOFF.md`](CODEX_HANDOFF.md).
- Current product behavior is mapped in
  [`product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](product/FEATURE_AND_BEHAVIOR_INVENTORY.md).

Re-verify drift-prone pointers before acting. A docs-only handoff merge may move
the integration SHA without changing the application tree.

## Preserved baselines

| Purpose | Git reference | Notes |
|---|---|---|
| Production fallback before hardening | `pre-hardening-8c38909` | Points to the unchanged production `main` commit `8c38909`. |
| Local workspace safety checkpoint | `4b7424a` | Contains the reviewed intended workspace except machine-local Claude settings. It is not a production release. |
| Pre-decomposition integration baseline | `0ad2fb6` flow checkpoint; application waves build on the integration branch | Production remains at `8c38909`; exact current integration must be re-derived. |
| Final decomposed release | Pending | Created only after every decomposition wave and full regression testing pass. |

At the checkpoint the repository contains 24,132 lines of TypeScript, TSX, and
CSS under `src/`, plus 7,938 lines of SQL under `supabase/`.

## Documents

- [Current architecture](architecture/CURRENT_ARCHITECTURE.md)
- [Feature and behavior inventory](product/FEATURE_AND_BEHAVIOR_INVENTORY.md)
- [Behavior contracts](quality/BEHAVIOR_CONTRACTS.md)
- [Bug-fix status](quality/BUG_FIX_PLAN.md)
- [Production-quality checklist](quality/FIX_CHECKLIST.md)
- [Decomposition plan](quality/DECOMPOSITION_PLAN.md)
- [Decomposition log](quality/DECOMPOSITION_LOG.md)
- [Supabase migration runbook](database/MIGRATION_RUNBOOK.md)
- [Deployment and rollback](operations/DEPLOYMENT_AND_ROLLBACK.md)
- [Manual regression checklist](testing/MANUAL_REGRESSION_CHECKLIST.md)
- [Mac setup checklist](setup/MAC_MIGRATION_CHECKLIST.md)
- [Codex context and process brief](CODEX_BRIEF.md)
- [Codex continuation handoff](CODEX_HANDOFF.md)
- [Google Drive and Slack collaboration workflow](COLLABORATION_WORKFLOW.md)

The older files in `docs/` are retained as audit inputs. If they disagree with
this directory, update this directory and record the evidence in the
decomposition log.

## Document status rules

- This directory is canonical for current engineering/release state.
- Root `ROADMAP.md` and root `docs/*.md` audit/checklist files are historical
  inputs unless their current-status banner says otherwise.
- Implemented source behavior and planned/marketed capability must remain
  explicitly distinguished.
- Repository docs are updated first; the exact existing Google handoff is the
  continuity mirror; `#bharatgrowth` receives concise verified milestones.

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
