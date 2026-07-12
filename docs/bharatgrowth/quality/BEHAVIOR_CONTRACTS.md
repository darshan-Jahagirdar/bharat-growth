# Behavior Contracts

These contracts freeze current intentional behavior during decomposition. A
change requires a separate feature/fix decision and PR.

## Billing and money

- Monetary API/database values use integer paise.
- GST calculations retain the current slab, rounding, CGST/SGST, IGST, and
  composition behavior.
- POS may complete a sale with negative inventory; this is intentional.
- Storefront and online order acceptance must reject insufficient stock.
- Credit/khata sale and repayment entries must remain tenant-scoped and ledger
  consistent.
- Loyalty is earned at sale time, including khata sales.
- Sales-order conversion currently does not add campaign attribution or loyalty.
- Discounts remain a product-design follow-up; decomposition must not invent a
  discount UI or new discount rules.
- Server-authoritative recomputation of POS totals is a separate hardening item,
  not decomposition work.

## Interaction

- Existing POS keyboard shortcuts, focus movement, barcode behavior, modal
  blocking, print flow, and payment confirmation order are preserved.
- Search results must not allow an older async response to replace a newer query.
- UPI confirmation uses the amount captured when the modal opens.
- Existing routes, query parameters, API payloads, response shapes, and exported
  library functions remain compatible during extraction.

## Time and tenancy

- Business dates use India Standard Time where the existing business rule is
  date-based, including financial-year boundaries.
- Authenticated operations derive and validate the active shop.
- Public receipt/storefront access reveals only explicitly safe fields.
- RLS and grants are part of the behavior contract; a visually working page is
  not evidence of tenant safety.

## Campaigns and messaging

- Marketing sends require current consent and respect existing cooldown, dedupe,
  and daily cap rules.
- STOP/opt-out behavior remains signature-verified and revokes consent through
  the database RPC.
- Message bodies and Meta template keys are not rewritten during decomposition.
