# BharatGrowth Deployment Guide

The maintained deployment, migration, and rollback process is documented in:

- [`docs/bharatgrowth/operations/DEPLOYMENT_AND_ROLLBACK.md`](docs/bharatgrowth/operations/DEPLOYMENT_AND_ROLLBACK.md)
- [`docs/bharatgrowth/database/MIGRATION_RUNBOOK.md`](docs/bharatgrowth/database/MIGRATION_RUNBOOK.md)
- [`docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md`](docs/bharatgrowth/testing/MANUAL_REGRESSION_CHECKLIST.md)
- [`docs/bharatgrowth/COLLABORATION_WORKFLOW.md`](docs/bharatgrowth/COLLABORATION_WORKFLOW.md)

Current decomposition work deploys only branch-scoped previews and integration
previews. Production remains at `8c38909`; this file does not authorize a
production deployment.

Do not place environment-variable values or credentials in this repository.
