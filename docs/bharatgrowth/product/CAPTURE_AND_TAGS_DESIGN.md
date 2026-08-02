# Capture & Tags — Product Design

**Author:** Claude (architecture), 2026-08-01. Approved direction from Darshan.
**Status:** Design agreed. Wave A is the implemented taxonomy contract; Waves
B–E remain separately scoped. Supersedes nothing; extends the retention engine
documented in `FEATURE_AND_BEHAVIOR_INVENTORY.md` §11.

---

## 1. The problem this solves

The Bring-Back engine only fires on **billed** sales. In the Indian SMB market a
large share of counter sales are never invoiced — driven mainly by income tax
exposure, the ₹1.5cr composition ceiling, and the need to keep declared sales
consistent with declared purchases. GST rate is a minor factor.

Result: the customer context that the moat depends on is a fraction of reality.
**Capture rate — the share of a shop's real transactions that produce a customer
record — is the metric the entire moat rides on.**

Two gaps, addressed separately:

- **Unbilled counter sales** → the **visit log** (§4)
- **Untagged catalogue** → **expanded tag taxonomy** (§3). A tyre shop today gets
  only "Tyres" and "Battery"; engine oil, filters, brake pads produce no
  campaign at all, and oil is the highest-frequency campaign in the vertical.

## 2. Findings from the current codebase (verified 2026-08-01)

- `find_campaign_matches` (037) matches: `campaign_rules → tags → invoices
  (status='completed', customer not null, invoice_date in trigger window with a
  2-day grace) → customers (dpdp_marketing_consent) → EXISTS invoice_items →
  products.tag_id = rule.tag_id`.
- Guards already present: dedupe on `(invoice_id, rule_id)`, **7-day
  per-customer cooldown across all rules**, one message per customer per run,
  per-shop daily cap. A per-customer frequency cap does **not** need building.
- `message_logs.invoice_id` is `NOT NULL` with `UNIQUE (invoice_id, rule_id)` —
  this is the single reason a non-invoice event cannot trigger a campaign.
- Attribution (035, in `save_invoice`): on save, the most recent unconverted
  `message_logs` row for that customer within **14 days** gets
  `converted_at` + `conversion_invoice_id`.
- `get_retention_stats` (041): `returned` is counted only when
  `inv.id IS NOT NULL`, so a conversion without an invoice would not count.
- **Composition shops already work.** There is no `document_type` filter in the
  match path, the attribution loop, or the stats RPC. Bill of Supply invoices
  behave identically to tax invoices. **No work required for composition.**
- `BusinessType` is `tyre_shop | sweet_stall | garment_store | general`, CHECK
  constrained in migration 002. **There is no grocery type** — grocery shops
  fall to `general`, which seeds exactly one tag.

## 3. Tag taxonomy

A tag earns its place only if it has a real repurchase cycle and a message a
customer would find useful. `trigger_days` values below are starting points.

**Automobile / tyre shop** (existing: Tyres 180+1100, Battery 1050)

| Tag | Rule | Days | Template | Custom variable |
|---|---|---:|---|---|
| Tyres | Free alignment check · 6 months | 180 | RESTOCK | a free wheel alignment & rotation check |
| Tyres | Tyre replacement due · 3 years | 1100 | RESTOCK | new tyres — it has been about 3 years |
| Battery | Battery health check · 3 years | 1050 | RESTOCK | a free battery health check |
| Engine Oil | Oil change due · 6 months | 180 | RESTOCK | an engine oil change — about 6 months due |
| Filters | Filter change due · 6 months | 180 | RESTOCK | an air & oil filter change |
| Brake Pads | Brake inspection · yearly | 365 | RESTOCK | a brake inspection — a year since last time |
| Coolant | Coolant top-up · yearly | 365 | RESTOCK | a coolant top-up before the summer heat |
| Wipers | Wiper replacement · 10 months | 300 | RESTOCK | new wiper blades before the monsoon |

**Grocery / kirana** (requires new `grocery` business type)

| Tag | Rule | Days | Template | Custom variable |
|---|---|---:|---|---|
| Staples | Monthly staples restock · 30 days | 30 | RESTOCK | your monthly rice, atta & dal restock |
| Cooking Oil | Cooking oil restock · 30 days | 30 | RESTOCK | cooking oil — about a month since last time |
| Cleaning & Detergent | Cleaning supplies · 40 days | 40 | RESTOCK | detergent & cleaning supplies |
| Personal Care | Personal care restock · 45 days | 45 | RESTOCK | soap, shampoo & daily essentials |
| Baby Care | Baby care restock · 21 days | 21 | RESTOCK | baby care essentials — diapers & formula |
| Pet Food | Pet food restock · 30 days | 30 | RESTOCK | pet food — time for the next bag |
| Festive & Dry Fruits | Festive dry fruits · yearly | 350 | NEW_ARRIVAL | fresh dry fruits & festive hampers |

**Garment store** (existing: Garments 170)

| Tag | Rule | Days | Template | Custom variable |
|---|---|---:|---|---|
| Garments | New season collection · 6 months | 170 | NEW_ARRIVAL | the new season collection |
| School Uniforms | School uniform season · yearly | 365 | NEW_ARRIVAL | school uniforms for the new academic year |
| Kids Wear | Kids outgrow sizes · 4 months | 120 | NEW_ARRIVAL | the next size up — kids grow fast |
| Festive Wear | Festive collection · yearly | 350 | NEW_ARRIVAL | festive collection for the season |
| Winter Wear | Winter collection · yearly | 365 | NEW_ARRIVAL | winter wear — sweaters, jackets & shawls |
| Ethnic & Sarees | Wedding season ethnic · 6 months | 180 | NEW_ARRIVAL | new ethnic wear for the wedding season |

**Sweet stall** (existing: Sweets 25, Gift Boxes 350)

| Tag | Rule | Days | Template | Custom variable |
|---|---|---:|---|---|
| Sweets | Fresh sweets nudge · 25 days | 25 | RESTOCK | fresh sweets, made today |
| Gift Boxes | Festive gift boxes · yearly | 350 | NEW_ARRIVAL | festive gift boxes for the season |
| Namkeen | Fresh namkeen nudge · 20 days | 20 | RESTOCK | fresh namkeen & savouries |
| Dry Fruits | Dry fruits restock · 3 months | 90 | RESTOCK | fresh dry fruits, newly stocked |
| Cakes | Celebration cake · yearly | 365 | NEW_ARRIVAL | a celebration cake — same time last year |
| Festive Specials | Festive specials · yearly | 350 | NEW_ARRIVAL | festive specials — made fresh this season |

**General**

| Tag | Rule | Days | Template | Custom variable |
|---|---|---:|---|---|
| Regular Items | We miss you · 45 days | 45 | PROMO | a special offer on your regulars |
| Seasonal | Seasonal collection · yearly | 350 | NEW_ARRIVAL | our new seasonal collection |

### Retrofit idempotency

The manual retrofit route reuses existing tags and considers a default rule
present when shop, tag, `trigger_days`, and `template_key` match. A second
sequential run is a true `0 tags / 0 rules` no-op and does not overwrite a
shop's customized rule fields or active state.

There is deliberately no database uniqueness constraint on that tuple because a
shop may legitimately create multiple custom rules with the same tag, interval,
and template. Concurrent manual retrofit requests can therefore race and create
duplicate defaults; this is an accepted residual risk for the manually
triggered route.

### Auto-tagging on bulk CSV import

Hybrid, and **never silent**:

1. **Dictionary pass** — keywords *plus brand names*, because Indian product
   names often omit the category ("MRF ZLX 165/80 R14" has no "tyre";
   "Castrol GTX" has no "oil"). Brands: MRF/Apollo/CEAT/Bridgestone → Tyres;
   Castrol/Servo/Shell/Mobil → Engine Oil; Exide/Amaron → Battery; etc.
2. **AI pass for unmatched rows** — one batched LLM call for the remainder, not
   one per product. Reuse the existing scan plumbing and quota accounting.
3. **Review screen** — proposed tag shown per product, bulk-editable, before
   commit. A wrong tag means a wrong campaign to a real customer.

## 4. Visit log

### Purpose and honest framing

The visit log captures **customers who bought but were not billed**. The
customer gives their number at the moment a bill would otherwise be issued.

**What keeps it clean is the absence of fields, not the name.** A record of
identity + interest category does not evidence a taxable supply or its value.

### Hard invariants — do not violate

1. **No amount. Ever.** No total, no price, no per-item value.
2. **No line items.** A single optional `tag_id` (interest category) only.
3. **No stock effect.** A visit never moves inventory. Stock is corrected via
   the existing manual `adjust_stock` path, which carries no customer link.
4. **Loyalty points on visits are flat**, never spend-scaled. Flat points are
   what make invariant 1 structurally self-defending — a spend-scaled scheme
   would require storing an amount.
5. **No reconciliation tooling.** No "declared vs actual" report, ever.
6. **No bulk delete.** Corrections leave an audit trail.
7. **Never marketed or described as tax-related**, anywhere.

Expect pressure to break #1 from inside the product (spend-scaled loyalty,
richer attribution, customer lifetime value). Refuse it.

### Schema

```sql
CREATE TABLE customer_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id      uuid REFERENCES tags(id) ON DELETE SET NULL,
  visit_date  date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

No amount column exists and none may be added. Authenticated users may read
their shop's visits, but cannot insert, update, or delete them directly. The
tenant-scoped `log_customer_visit` RPC validates customer and tag ownership and
is the only application write path; visits remain append-only.

### Attribution generalisation

`message_logs` gains a second, mutually exclusive source:

```sql
ALTER TABLE message_logs
  ALTER COLUMN invoice_id DROP NOT NULL,
  ADD COLUMN visit_id uuid REFERENCES customer_visits(id) ON DELETE CASCADE,
  ADD COLUMN conversion_visit_id uuid REFERENCES customer_visits(id) ON DELETE SET NULL,
  ADD CONSTRAINT message_logs_one_source CHECK (
    (invoice_id IS NOT NULL AND visit_id IS NULL) OR
    (invoice_id IS NULL AND visit_id IS NOT NULL)
  );
```

Replace `UNIQUE (invoice_id, rule_id)` with two partial unique indexes, one per
source. Existing rows all carry `invoice_id`, so this is backward compatible.

### Match logic

`find_campaign_matches` unions a visit-sourced branch onto the existing
invoice-sourced branch. The visit branch matches `customer_visits.tag_id =
campaign_rules.tag_id` directly (no product join — a visit has no items). All
existing guards — consent, dedupe, 7-day cooldown, one-per-customer-per-run,
daily cap — apply across the union.

⚠️ The `RETURNS TABLE` signature changes (adds `visit_id`), so this requires
`DROP FUNCTION` + `CREATE`, and the cron consumer must ship in the same
deployment.

### Conversion semantics

- Customer returns and is **billed** → existing `save_invoice` attribution
  handles it unchanged; `conversion_invoice_id` set; **revenue counted**.
- Customer returns and is **logged as a visit** → the visit RPC performs the
  same 14-day attribution update, setting `converted_at` and
  `conversion_visit_id`; **counted as returned, no revenue**.
- `get_retention_stats` must drop `AND inv.id IS NOT NULL` from the *returned*
  count while keeping revenue invoice-only.

Resulting ROI card: *"14 customers came back · ₹X attributed (billed returns)."*
Honest, and the shop's headline number improves when they bill — the incentive
points the compliant way without the product ever mentioning tax.

### Residual attribution concurrency risk

The source of a message is exclusive: every `message_logs` row belongs to
exactly one invoice or one visit. Its conversion destination is deliberately
not exclusive. A simultaneous billed return and logged visit can both select
the same previously unconverted message before either update becomes visible,
leaving both `conversion_invoice_id` and `conversion_visit_id` populated.

This is accepted for now. `save_invoice` remains unchanged, and adding a
conversion-destination `CHECK` could turn the race into a failed bill save.
Retention stats remain honest in the residual state: the customer is counted
once as returned, and revenue is included only from a completed conversion
invoice.

### Capture UX

A secondary **Visit** action in the billing header (`F6`). First time for a
customer: phone, optional name, optional interest tag. Every subsequent visit:
one tap on the existing customer. The modal owns a separate instance of the
existing characterized customer search and never reads or changes the bill
draft. Consent uses the same explicit, default-on record as billing:

> Customer agreed to receive purchase acknowledgements, loyalty updates, and
> offers on WhatsApp

Consent is obtained verbally, in person: the shopkeeper asks at the counter and
cross-checks the form before submitting. The checked box records that verbal
affirmative; it is not the mechanism that obtains consent. Its helper says:

> Untick if the customer declined. Consent is optional and can be withdrawn at
> any time.

Visit capture records two separate consent purposes transactionally. Required
`data_collection` consent covers holding the customer's identity and visit
context, so `dpdp_data_consent` is set unconditionally for every non-replayed
visit and a separate append-only grant is written. Optional
`whatsapp_marketing` consent remains driven by the checkbox, OR-preserves an
existing affirmative, and is independently required for the acknowledgement
send.

Storefront checkout already follows the required-data / optional-marketing
model. POS billing customer creation does not: it currently omits
`dpdp_data_consent` and appends only a `whatsapp_marketing` log. That is a
pre-existing gap, scoped separately because a correct fix likely requires a
transactional RPC for the currently client-side creation path; Wave D does not
change its characterized behaviour.

The customer receives a thank-you with their points balance — this is the value
exchange that makes both the customer accept being logged and the shopkeeper's
tap feel productive. It is a WhatsApp utility message (~₹0.145 each); at 100
visits/day that is ~₹435/month per shop and belongs in the COGS model.

### Capture and acknowledgement replay safety

The visit RPC requires a caller-generated request UUID, unique per shop. A
replay returns the original visit before customer, consent, loyalty, or
attribution side effects, so retrying an uncertain HTTP response cannot create
a second visit or point.

An acknowledgement requires both independent gates at send time:
`shops.campaigns_approved = true` and persisted affirmative customer consent.
A durable one-per-visit claim is written before the Meta call. Claims live in a
separate service-only table, not `message_logs`, because acknowledgements are
not campaign-attribution events and must not affect cooldown, cap, conversion,
or ROI calculations. Simulation retains the claim like a successful send.
Definite configuration/API rejection releases it; an ambiguous network outcome
retains it to prevent duplicate paid messages. A crash after claiming but
before the provider accepts the message can therefore lose one acknowledgement;
that conservative residual risk is preferred to duplicate spend and duplicate
customer messages on the shared platform number.

Simulation logs redact all template variables. Simulation is enabled only when
both Meta credentials are absent; partial credentials fail closed without a
provider request.

### Capture instrumentation

The dashboard does not claim to measure a true capture rate because real
unbilled transaction volume has no observable denominator. It reports:

- **Customer captures** — completed identified bills plus visit events in the
  selected IST period (events, not unique people).
- **Bills with customer** — completed identified bills divided by all completed
  bills in that period. With no bills, the result is `— / No bills`, never
  `0%`.

## 5. Campaign approval gate

All shops send through one shared platform WhatsApp number. A single shop
blasting a purchased list degrades the number's Meta quality rating and can
restrict or ban messaging **for every shop at once**. Therefore:

- `shops.campaigns_approved boolean NOT NULL DEFAULT false` (+ `_at` timestamp)
- `find_campaign_matches` filters on it
- Manually approved by BharatGrowth initially; automate later on consent
  provenance, volume, and per-shop opt-out/block-rate monitoring with
  auto-pause, plus quiet hours.

## 6. Deliberately out of scope

- Sales Note as an alternative document for **registered** shops — dropped.
- The ₹200 consolidated-invoice capped mode — dropped as too narrow.
- QR / customer-initiated capture — dropped; customers will not scan for routine
  purchases, and warranty buyers take a bill anyway.
- An `unregistered` shop type — a genuine correctness gap (such shops are
  currently forced into `regular` or `composition`, both wrong) but a later
  cleanup, not part of this work.
- Loyalty **redemption** design — separate work.

## 7. Decisions and open questions

- Points awarded per visit is resolved at **1 flat point**, owned by the
  database RPC with no caller-supplied points or amount.
- The Visit action is resolved as a secondary billing-header action labeled
  **Visit**, with `F6` as its shortcut.
- The consent checkbox defaults **checked** in visit capture and billing
  customer creation. Consent is obtained verbally in person; the checkbox is
  the shopkeeper's explicit record of the affirmative. Default-on represents
  the overwhelmingly common case and avoids silently excluding a consenting
  customer when a busy operator forgets to tick. Consent remains optional,
  persisted explicitly, independently required alongside campaign approval for
  acknowledgement sending, append-logged, and withdrawable. **Residual risk:**
  a shop that does not actually ask the customer creates a false consent record.
  This requires later operational monitoring and consent-provenance controls;
  the UI default does not make the record legally true.
- Visit consent uses the storefront's two-purpose model: data collection is
  unconditional because the visit stores identity and context; WhatsApp
  marketing remains optional. Each purpose is append-logged separately and an
  idempotent replay adds neither log.
- POS billing customer creation still omits required data consent and its
  `data_collection` log. This pre-existing Wave 1 characterization gap is
  tracked separately rather than being changed inside Wave D.
- Whether the 7-day cooldown needs to widen for the grocery vertical, where
  several tags fire on 20–45 day cycles.

## 8. Verification questions for a GST practitioner

- Typical billed-vs-unbilled proportions by shop size and scheme — this
  determines how much of the moat rides on the visit log.
- Whether BharatGrowth's storefront could be construed as an **e-commerce
  operator** under CGST §52. Composition dealers lose eligibility if they sell
  through one. BharatGrowth never collects the consideration, which likely puts
  it outside the definition — **confirm before onboarding any composition shop
  onto the storefront, and never route customer payments through the platform.**
