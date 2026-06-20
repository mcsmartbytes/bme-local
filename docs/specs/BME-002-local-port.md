# BME-002: books-made-easy → bme-local Full Port

**Status**: Approved — building & testing (client waiting)

**Spec Prefix**: BME-

**Depends on**: [BME-001-local-smart-db.md](./BME-001-local-smart-db.md)

## Intent

Port the complete **Books Made Easy** application to **bme-local** as a **local-only component** — same stack as ops-made-easy (Next.js local server, LibSQL, Drizzle, JWT, local SLM). **No Supabase. No Vercel.**

Reuse the hours already invested in `me-platform/apps/books-made-easy` (UI, API logic, `turso/schema.sql`). Replace cloud data layer with local Drizzle. Other FolkTech components will communicate via local HTTP API + JWT later.

**Not cloud-hosted web SaaS.** Runs on the bookkeeper's machine via `npm run run:local`. Data in `data/local.db`.

## Locked decisions (2026-06-20)

- Supabase and Vercel are **out** — not optional fallbacks
- Port/clone existing BME — do **not** rewrite from scratch
- **All features** are in scope; execute in vertical slices until parity
- **Client is waiting** — prioritize usable bookkeeping program ASAP
- `db/schema-bme.ts` is canonical schema (910 lines, 45 tables)
- Source: `me-platform/apps/books-made-easy` + `turso/schema.sql`

## Architecture

```
books-made-easy (UI + API logic)
        ↓ copy & adapt
bme-local (BME-001 foundation)
        ↓ replace
Supabase     → Drizzle + LibSQL
Supabase auth → JWT (cookie + bearer)
Anthropic    → local SLM (lib/slm-client.ts)
Cloud storage → data/documents/ (local filesystem)
```

## Execution order (client-first)

### Sprint 1 — Usable program (P0 client deliverable)

**Goal:** Login → real dashboard → manage customers, invoices, bills, vendors.

- [x] `db/schema-bme.ts` — full Turso schema in Drizzle
- [ ] Cutover `db/schema.ts` → export `schema-bme.ts`
- [ ] Auth: text UUID users, login → `/dashboard`
- [ ] Copy: Tailwind, globals.css, DashboardLayout, Providers, login page
- [ ] Port APIs (Drizzle): `customers`, `vendors`, `invoices`, `bills`, `accounts`, `dashboard`
- [ ] Port UI pages: dashboard, customers, invoices, bills, vendors, accounts
- [ ] Seed: bookkeeper user + default COA + demo customer + invoices
- [ ] `npx drizzle-kit push` on fresh `data/local.db`
- [ ] Build + CAT4/CAT7 tests pass

**Client done-when:** Bookkeeper logs in, sees dashboard with nav, creates/edits customers and invoices, enters bills.

### Sprint 2 — Core accounting

- [ ] Payments (`payments`, `payments_received`, `payments_made`)
- [ ] Journal entries + lines
- [ ] Categories, products/services
- [ ] Estimates → invoice conversion
- [ ] Deposits

### Sprint 3 — Banking & expenses

- [ ] Bank accounts, transactions, reconciliations, import
- [ ] Expenses, merchant rules, recurring, budgets, mileage
- [ ] Core reports: P&L, balance sheet, AR/AP aging

### Sprint 4 — Bookkeeper firm features

- [ ] Organizations, entities, entity switcher
- [ ] Tasks, documents (local files), close checklist
- [ ] Firm dashboard, client stats
- [ ] Transaction anomaly alerts

### Sprint 5 — Jobs, payroll hooks, integrations

- [ ] Jobs, job phases, cost codes, retainage
- [ ] Payroll UI stubs → local API to payroll-made-easy component (later)
- [ ] Expenses/sitesense component hooks (local HTTP, JWT)
- [ ] Intelligence layer wired to full schema

### Sprint 6 — Production hardening

- [ ] Full test coverage per domain
- [ ] `npm run build` clean
- [ ] README: client onboarding, backup, models path
- [ ] Optional Electron shell (if needed for "not browser" delivery)

## Acceptance criteria (production)

- [ ] Zero Supabase / Vercel packages in `package.json`
- [ ] All P0–P3 features work offline against `data/local.db`
- [ ] Every API route scopes by `user_id` (CAT4)
- [ ] SLM output treated as untrusted text (CAT7)
- [ ] `npm run build` and `npm test` pass
- [ ] Client can run day-one bookkeeping without cloud accounts

## Files in progress

| Asset | Path | Status |
|-------|------|--------|
| Full schema | `db/schema-bme.ts` | Done |
| UI source | `me-platform/apps/books-made-easy/src/` | Copy started |
| Auth adapter | `utils/apiAuth.ts`, `utils/apiFetch.ts` | Pending |
| Local contexts | `contexts/AuthContext.tsx` (no Supabase) | Pending |

## Out of scope

- Cloud sync, Stripe billing, hosted multi-tenant SaaS
- Supabase/Vercel as fallback paths

## Related

- BME-001 foundation: `docs/specs/BME-001-local-smart-db.md`
- Source app: `me-platform/apps/books-made-easy`
- Stack reference: `ops-sense/apps/ops-made-easy`