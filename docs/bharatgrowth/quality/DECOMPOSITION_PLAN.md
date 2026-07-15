# Behavior-Preserving Decomposition Plan

Current status (2026-07-15): Waves 1–6 are merged only into integration at
`6255234`. The exact application-source checkpoint is `145437b`; a docs-only
Wave 7 handoff merge may advance the integration pointer without changing
application source. Wave 7 data access is next and is the final decomposition
wave. Production remains `8c38909` and untouched.

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
| 6 Storefront | `6255234` | Merged and staging-verified; characterization rollback `ac7fe57`; pixel comparison explicitly waived by Darshan before the intentional reskin. |
| 7 Data access | Pending | Next. Exact data-access characterization must precede implementation movement. |

## Wave 6 Storefront retained contract

Wave 6 started from verified integration `d9d7b4f`; its application-source
checkpoint is `145437b`, merged only into integration at `6255234`. The contract
below remains the audit record for that completed wave.

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

## Wave 7 data-access contract

Wave 7 starts from the freshly verified remote integration head after the
docs-only Wave 7 handoff PR. Confirm the application tree beneath that docs-only
merge remains exact application checkpoint `145437b`.

The in-scope compatibility facades are:

- `src/lib/billing/billingQueries.ts` — 408 lines;
- `src/lib/orders/orderQueries.ts` — 431 lines;
- `src/lib/dashboard/dashboardQueries.ts` — 672 lines;
- `src/lib/storefront/queries.ts` — 129 lines.

### Characterization checkpoint before implementation movement

Add focused module-level tests against the unchanged facades and commit them
before moving any implementation. Freeze:

- every exported symbol, interface, constant, parameter default, return shape,
  fallback, thrown-versus-returned error, warning/error side effect, and public
  client-versus-authenticated client boundary;
- exact table/RPC/storage names, selected columns and joins, filters and their
  order, sort/null behavior, pagination/range/limit values, mutation payloads,
  optional-argument omission, and call sequencing;
- Billing search sanitization, lazy loyalty, barcode, invoice/repayment RPCs,
  refresh, customer image/create/consent flow, and shop context;
- Orders header-then-item fetches, grouping, 50-row `hasMore`, create/convert
  RPCs, guarded cancellation mutations, and error mapping;
- Dashboard IST ranges, parallel KPI/data orchestration, retention RPC mapping,
  khata/stock queries, aggregation/rounding, and GST export row order/output;
- Storefront public shop plus owner-phone RPC behavior, active catalog
  selection/order, tracked/untracked/missing inventory mapping, and non-fatal
  contact/product failures.

Record zero pre-extraction source diff for the four facades. The characterization
commit is the Wave 7 rollback boundary.

### Implementation order

1. Extract cohesive shared types only where the original exported identity and
   module path remain compatible.
2. Split Billing and Orders reads/writes by use case without changing a query,
   RPC, error path, or caller import.
3. Split Dashboard analytics/retention/stock/GST and Storefront public shop/
   catalog data by use case under their existing trust boundaries.
4. Leave the four original facade paths as explicit compatibility exports and
   prove every existing caller still resolves the same symbols.

No route, component, hook, page, copy, style, DOM, visual, focus, keyboard,
payload, API, SQL, migration, RLS, policy, grant, function, provider, Auth, or
workflow change belongs in Wave 7. Migration 049 and Storefront public-boundary
hardening remain separate post-decomposition work.

The Wave 7 browser gate is limited to representative data-flow evidence that
module-level mocks cannot prove: public Storefront loading and bounded protected
Billing, Orders, and Dashboard reads on the exact staging deployment. If no
TSX/CSS/DOM source changes, do not manufacture a duplicate pixel comparison;
record the zero UI-source diff and exact rendered data-flow/console evidence.

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
