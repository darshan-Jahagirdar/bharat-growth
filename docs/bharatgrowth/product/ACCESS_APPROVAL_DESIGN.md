# Access Approval Gate — Product Design

**Author:** Claude (architecture), 2026-08-02. Decisions: Darshan.
**Purpose:** make the app safe to expose publicly at `bharatgrowthshop.com`.
Anyone may sign up; nobody reaches the product until Darshan approves them.

---

## 1. Why this exists

The production rollout puts a hardened, reskinned app at a public domain. Without
a gate, any visitor who signs up lands straight in a live billing workspace. This
turns signup into a **request**, keeping a soft launch curated and reversible.

**This is a second, independent gate.** `shops.campaigns_approved` (Wave B)
controls whether a shop may send WhatsApp. This controls whether they may use the
app at all. **Approving access must never auto-approve campaigns** — a shop can
bill for weeks before being trusted near the shared WhatsApp sender.

## 2. Flow

1. Visitor taps the landing CTA → signs up with phone or email OTP
2. Instead of onboarding, they see a **request form**: full name, business name,
   business type, city, **email** (see §5 — required even for phone signups)
3. Submit → *"Thanks. We're onboarding shops one at a time. We'll email you when
   your shop is ready."*
4. Darshan reviews the queue at `/admin` and approves
5. Resend emails them; next login lands them in normal onboarding

**Grandfathering rule: the gate applies to *getting* a shop, not *having* one.**
Any user with a `users.shop_id` is unaffected — every existing test account keeps
working, and no data migration is needed.

## 3. Schema

`access_requests`: `id`, `user_id` (FK auth.users, unique), `full_name`,
`business_name`, `business_type`, `city`, `email`, `status`, `requested_at`,
`reviewed_at`.

`status` is `pending | approved | dismissed`.

- **There is no rejection.** Unwanted requests stay `pending` forever and are
  never told (Darshan's decision).
- `dismissed` exists only so the admin queue stays usable if it fills with spam.
  It sends nothing and tells the user nothing — it hides the row from the default
  view. Functionally identical to pending from the user's side.

### The security rule — this is the important one

RLS must allow a user to **insert their own request** and **read their own
status**, and must **never** allow them to update `status`.

The INSERT boundary is as important as UPDATE: authenticated callers receive
INSERT only on the six request-input columns, and the policy requires
`user_id = auth.uid()`, `status = 'pending'`, and `reviewed_at IS NULL`. Decision
and audit columns are database-owned, so a first request cannot arrive already
approved.

This is the exact bug Codex caught in Wave B: `shops_update` was row-scoped with
no column restriction, so a shop could have self-approved with one PostgREST call.
Apply the same fix — a `BEFORE UPDATE` trigger that **raises loudly** (never
silently resets) when `anon` or `authenticated` attempts to change `status` or
`reviewed_at`. Approval happens only through the admin path.

The own-row UPDATE policy deliberately allows protected-column attempts to
reach that trigger. Without it, RLS can return a success-shaped zero-row update
before the trigger runs. Column privileges expose only `status` and
`reviewed_at` to UPDATE, and the trigger always raises SQLSTATE `42501` for
those roles.

A user must never be able to approve themselves.

## 4. Where the gate lives — prefer the route, not middleware

**Do not add a database read to middleware.** It currently reads the session from
cookies with no network call, deliberately (see the comment in `middleware.ts`
about server-side fetch timeouts). Adding a query there risks the whole protected
surface.

Instead, make `/onboarding` a **three-state server-rendered route**:

| User state | Renders |
|---|---|
| no request | the request form |
| request `pending` or `dismissed` | the pending message |
| request `approved` | the existing onboarding flow, unchanged |
| already has a `shop_id` | redirect to `/billing` as today |

`/billing` and `/dashboard` do not safely redirect without a shop: billing
otherwise exposes an empty workspace and dashboard can remain in a permanent
loading state. Server layouts therefore resolve `users.shop_id` and redirect a
profile-less user to `/onboarding`. Middleware remains unchanged and performs
no database read.

The existing `POST /api/onboarding` route is the privileged write boundary,
because it uses the service role to create the shop and owner membership. It
must independently require the authenticated caller's request to be
`approved`, immediately before shop creation. The page is convenience, not an
authorization boundary. Existing users with a shop remain grandfathered, and
shop creation leaves `shops.campaigns_approved` at its independent default
`false`.

## 5. Email is required on the form

A user may sign up with **phone**, in which case no email exists on their auth
record — and the approval notification is by email. So the request form must
collect email as a required field regardless of signup method.

## 6. Admin surface

Route `/admin`. Not linked from anywhere, not in nav, `noindex`.

**Identity: a single admin email in an environment variable.**

- `PLATFORM_ADMIN_EMAIL` — **never** prefixed `NEXT_PUBLIC_`, which would ship it
  to the browser
- The check is **server-side only**, never a client-side conditional
- Compare case-insensitively against the authenticated user's email
- Note: admin therefore requires logging in **by email**, not phone. That is
  acceptable and arguably desirable — one specific path to the most sensitive
  surface in the product

⚠️ **This makes that mailbox the keys to the platform.** It must have 2FA.

The page lists pending requests with their details and an Approve action, plus a
Dismiss action. Approval is a server action that verifies admin identity again
server-side — never trusting that the page rendered means the caller is admin.

## 7. Approval notification

On approval, send via **Resend** (direct API call, not Supabase Auth SMTP):
subject and body confirming their shop is ready, with a link to log in.

Requires `RESEND_API_KEY` in the production environment. Same Resend account and
verified domain already used for auth email; a separate API key is cleaner so it
can be rotated independently.

The sender is configured separately as `RESEND_FROM_EMAIL`, initially
`hello@bharatgrowthshop.com`, so it can change without a deploy. Approval links
use the configured `NEXT_PUBLIC_APP_URL`, never an untrusted request Host
header.

Failure to send must **not** roll back the approval — log it and let Darshan
follow up manually. Approval is the source of truth; the email is a courtesy.

## 7.1 Accepted residuals

- The UI renders `dismissed` exactly like `pending`, but a technical user can
  distinguish the raw status through their own RLS-scoped SELECT. This is
  accepted observability: "kept pending" is a communication decision, not a
  cryptographic concealment requirement.
- Email collected for a phone-authenticated requester is not independently
  verified. It cannot grant access because approval remains tied to the auth
  user ID, but notification could be delivered to an incorrectly entered
  address.

## 8. Landing page copy change

CTA becomes **"Request early access"** rather than "Start free". For a curated
soft launch this reads as scarcity rather than limitation, and it is honest —
"Start free" followed by a waitlist is a bait-and-switch.

## 9. Tests

- Non-admin hitting `/admin` is denied, server-side
- An authenticated user cannot update their own `status` (trigger raises)
- `/onboarding` renders the correct state for: no request, pending, approved,
  has-shop
- Approval transitions status and records `reviewed_at`
- Email send is mocked; a send failure does not roll back approval
- Existing users with a `shop_id` are entirely unaffected

## 10. Sequencing

**One Codex wave, end to end** — schema, RLS, trigger, the three-state onboarding
route, the admin page, Resend integration, tests. The pages are simple and inherit
the design tokens automatically; splitting this across two sessions would cost
more in coordination than it saves.

**Then** the production rollout, **then** the domain. The gate must exist before
the app is publicly reachable — that ordering is the entire point.
