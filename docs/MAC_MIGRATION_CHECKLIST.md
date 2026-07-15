# BharatGrowth Mac Migration Checklist

> Historical machine-move detail. Current task continuation and Google/Slack
> operating rules live in
> [`docs/bharatgrowth/CODEX_HANDOFF.md`](bharatgrowth/CODEX_HANDOFF.md) and
> [`docs/bharatgrowth/COLLABORATION_WORKFLOW.md`](bharatgrowth/COLLABORATION_WORKFLOW.md).

Use GitHub as the source of truth for code and cleaned docs. Use a password manager or secure secret handoff for environment variables. Avoid moving local build artifacts or generated repo dumps.

## 1. Freeze The Windows Source

Before moving machines:

1. Run the full local gate on Windows:
   ```powershell
   git diff --check
   git diff --cached --check
   npx tsc --noEmit --incremental false --pretty false
   npm run lint
   npm run build
   npm audit
   npm audit --omit=dev
   ```
2. Review `git status --short`.
3. Commit only the intended app, migration, dependency, and cleaned documentation files.
4. Push to GitHub.
5. Confirm the latest GitHub commit hash matches the Windows local commit:
   ```powershell
   git rev-parse HEAD
   git ls-remote origin HEAD
   ```

Do not commit or transfer:

- `.env.local`
- `.vercel/`
- `.next/`
- `node_modules/`
- `.codex/`
- `.claude/`
- `repomix-output.xml`
- duplicate top-level `components/`, `hooks/`, or `lib/` folders unless they are intentionally adopted by the app

## 2. Prepare The Mac

Install:

```bash
xcode-select --install
```

Recommended Homebrew packages:

```bash
brew install git node
```

If you prefer Node version pinning, install `nvm` and use the Node version required by the deployed project. The current package requires Node `>=20.18.1` through `undici`.

## 3. Clone And Install

```bash
git clone <github-repo-url> BharatGrowth
cd BharatGrowth
npm ci
```

Run the local gate:

```bash
npx tsc --noEmit --incremental false --pretty false
npm run lint
npm run build
npm audit
npm audit --omit=dev
```

## 4. Recreate Local Environment

Create `.env.local` from `.env.example`. Do not copy secrets through Google Drive or chat.

Required categories:

- Supabase URL and anon key.
- Supabase service-role key for server-only routes.
- `NEXT_PUBLIC_APP_URL`.
- `CRON_SECRET`.
- `OPENAI_API_KEY` if bill-scan features are tested.
- WhatsApp provider credentials when production messaging is tested.

For local testing:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production Vercel:

```bash
NEXT_PUBLIC_APP_URL=https://bharat-growth.vercel.app
```

## 5. Supabase

Project:

- Ref: `vyycczqhvsgkiqtxxxos`
- URL: `https://vyycczqhvsgkiqtxxxos.supabase.co`

On the Mac:

```bash
npx supabase login
npx supabase link --project-ref vyycczqhvsgkiqtxxxos
npx supabase db push --dry-run
```

Stop if the dry run does not report the remote database as up to date or only the expected pending migrations. Do not run destructive DB commands during migration.

Supabase Auth URL settings must include:

- `https://bharat-growth.vercel.app`
- `https://bharat-growth.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`

This is required for email confirmation and magic-link login to avoid redirecting testers to a dead localhost URL.

## 6. Vercel

```bash
npx vercel login
npx vercel link
```

Use Vercel as the source for deployed environment variables. If you pull envs locally, keep the generated file uncommitted.

Verify production env categories:

- Supabase URL, anon key, and service-role key.
- `CRON_SECRET`.
- `OPENAI_API_KEY`.
- `NEXT_PUBLIC_APP_URL=https://bharat-growth.vercel.app`.
- WhatsApp provider settings when messaging is live.

## 7. Local Smoke On Mac

```bash
npm run dev
```

Check:

- `/` loads.
- `/login` loads.
- Logged-out `/billing` redirects.
- Email magic link redirects to `/auth/callback`.
- Phone OTP still works if enabled in Supabase.
- Storefront checkout rejects missing consent.
- Billing page loads after login.

## 8. Preview And Production Smoke

After the Mac environment is working:

1. Push a test branch.
2. Use Vercel preview.
3. Run the bounded smoke checklist:
   - Storefront same `idempotency_key` replay creates one order.
   - Different `idempotency_key` creates a new intentional order.
   - Missing consent fails.
   - Online accept cannot make stock negative.
   - POS same-shop product invoice succeeds.
   - POS manual line succeeds.
   - POS foreign product/customer ids are rejected.
   - POS negative stock remains allowed by design.
   - Khata sale and payment reconcile after refresh.
4. Promote or merge only after preview passes.
5. Run one tiny production smoke and clearly mark any test data.

## 9. Google Drive Policy

Use Google Drive only for sanitized non-code artifacts, such as planning docs, screenshots, or exported reports that do not contain secrets.

Prefer GitHub for:

- Source code.
- Migration files.
- Clean markdown docs.
- Package lockfile changes.

Never upload:

- `.env.local`
- Supabase service-role keys.
- DB passwords.
- Vercel tokens.
- `repomix-output.xml`
