# Behavior-Preserving Decomposition Plan

Current status (2026-07-15): Waves 1–5 are merged only into integration. The
application checkpoint is `907dfe3`; a docs-only handoff merge may advance the
integration pointer without changing application source. Wave 6 Storefront is
next. Production remains `8c38909` and untouched.

## Rules

- One domain per independently revertible PR.
- No feature, schema, migration, query-facade outside Wave 7, copy, styling,
  payload, visual, focus, keyboard, RLS, stock, consent, provider, workflow, or
  behavioral change inside a decomposition PR.
- Keep compatibility exports while moving implementation ownership.
- Extract pure logic first, then hooks/controllers, then focused views.
- Prefer cohesion over a mechanical line target. Route pages should normally be
  under 300 lines and focused components under 250 lines after completion.
- Do not refactor generated/general UI primitives without evidence of a defect.
- Preserve every source-backed purpose and invariant in
  [`../product/FEATURE_AND_BEHAVIOR_INVENTORY.md`](../product/FEATURE_AND_BEHAVIOR_INVENTORY.md).

## Integration strategy

- `codex/production-hardening-baseline` is the integration/staging branch and
  remains the head of draft PR #1 to `main`.
- Each wave uses a short-lived `codex/decompose-*` branch and an independently
  revertible PR targeting the integration branch.
- A wave merges into the integration branch only after CI, staging preview,
  visual comparison, targeted manual smoke, and its log entry pass.
- Production remains unchanged until all seven waves and every approved launch
  feature are staging-verified. The reviewed integration result then merges to
  `main` only in the separately approved single controlled pre-launch rollout.

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

## Completed wave checkpoints

| Wave | Integration merge | Current status |
|---|---|---|
| 1 Billing/POS | `e6b58e3` | Merged and staging-verified. |
| 2 Orders | `1695da7` | Merged and staging-verified. |
| 3 Products | `b38e0ad` | Merged and staging-verified. |
| 4 Dashboard/progress | `ac75c68` | Merged; characterization rollback `74fc96b`; query facade unchanged. |
| 5 Purchases | `907dfe3` | Merged; characterization rollback `2e6bec8`; Purchase History/query facade unchanged. |
| 6 Storefront | Pending | Next. Characterization must precede application edits. |
| 7 Data access | Pending | Starts only after Wave 6 merge and staging smoke. |

## Wave 6 Storefront contract

Wave 6 starts from the freshly verified remote integration head. The expected
application tree beneath any handoff-doc merge is Wave 5 application checkpoint
`907dfe3`.

Characterize the unchanged loader/public mapping, all three theme dispatch and
outputs, Modern category/search behavior, strict-stock cart, checkout fields and
consent, idempotency, exact API/WhatsApp payloads, and error/success ordering.
Commit this before any Storefront application-source extraction.

Then extract:

1. pure category/filter/price/placeholder/cart/payload/message transforms;
2. cart and checkout controllers/hooks while keeping effects and query shapes
   exact;
3. focused Modern header/catalog/cart/checkout views.

Industrial and Festive are already focused theme outputs. Share code only when
the rendered behavior for all themes stays exact; do not give them Modern cart
behavior. Keep `src/lib/storefront/queries.ts` compatible and out of query-facade
restructuring until Wave 7.

## Per-wave gate

- Characterization tests exist before extraction.
- Lint, typecheck, unit tests, and build pass.
- Relevant browser flows and visual baselines match.
- Payloads and exported interfaces are unchanged.
- Decomposition log contains commit, PR, preview, checks, and rollback point.
- Previous wave is merged into the integration branch and staging-smoked before
  the next wave begins.
- Google handoff readback and `#bharatgrowth` milestone reflect the exact result;
  temporary staging profiles, sessions, fixtures, variables, previews, and
  evidence artifacts are removed and cleanup is verified.
