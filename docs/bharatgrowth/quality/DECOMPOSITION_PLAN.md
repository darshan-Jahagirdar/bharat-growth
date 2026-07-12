# Behavior-Preserving Decomposition Plan

## Rules

- One domain per independently revertible PR.
- No feature, schema, copy, styling, or behavioral change inside a decomposition
  PR.
- Keep compatibility exports while moving implementation ownership.
- Extract pure logic first, then hooks/controllers, then focused views.
- Prefer cohesion over a mechanical line target. Route pages should normally be
  under 300 lines and focused components under 250 lines after completion.
- Do not refactor generated/general UI primitives without evidence of a defect.

## Waves

1. **Billing/POS:** data loading, customer/product search, sale actions, SO/UPI
   flows, keyboard controller, cart/workspace views.
2. **Orders:** shared formatting, sales-order panel, purchase-order panel,
   status/action dialogs.
3. **Products:** form/validation, inventory view, campaign tags, data hooks,
   money conversions.
4. **Dashboard/progress:** data orchestration, metrics, charts, retention/progress
   sections, pure transforms.
5. **Purchases:** state/controller, editable grid, keyboard behavior, AI scan
   mapping, totals, draft and save actions.
6. **Storefront:** catalog/filter, cart, checkout controller/dialogs, shared theme
   sections while keeping theme output stable.
7. **Data access:** split query modules by use case behind compatibility exports.

## Per-wave gate

- Characterization tests exist before extraction.
- Lint, typecheck, unit tests, and build pass.
- Relevant browser flows and visual baselines match.
- Payloads and exported interfaces are unchanged.
- Decomposition log contains commit, PR, preview, checks, and rollback point.
- Previous wave is merged and production-smoked before the next wave begins.
