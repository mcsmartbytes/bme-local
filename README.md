# books-made-easy-local

Local-only version of Books Made Easy with its own smart database.

**Stack (modeled on ops-sense):**
- Next.js 16 + TypeScript
- LibSQL / data/local.db (Drizzle ORM) — each bookkeeper has their own isolated DB (placed in data/ so file changes don't spam the dev watcher/HMR)
- JWT + bcryptjs auth
- SLM-powered intelligence (analysis, recommendations, monitoring, corrections, notifications) using local models from your Models directory
- No Supabase. No Vercel dependency for core.

## Prerequisites
- Node 20+
- Your local models directory at `C:\Users\Michelle\Models` (or set MODELS_PATH)

## Quick Start

```bash
npm install

# One-time: create tables from schema
npx drizzle-kit push

# Seed demo data + admin user
npm run dev
# In another terminal or browser: visit http://localhost:3000/api/db/init

# Or use the easy wrapper
npm run run:local
```

Then open http://localhost:3000 (or the port shown).

## Configuration (.env.local)
```
MODELS_PATH=C:\Users\Michelle\Models
SLM_MODEL=Qwen3-4B-Q4_K_M.gguf
JWT_SECRET=some-long-random-secret
ADMIN_EMAIL=bookkeeper@local
ADMIN_PASSWORD=change-me
```

## Run & Connect
- **run**: `npm run dev` or `npm run run:local` (wrapper)
- **connect**: Open localhost in browser. Your data lives in `data/local.db` (easy to backup/copy; DB writes no longer spam the dev HMR because of watcher ignores + subdir).

The wrapper prints the models dir and gives connect instructions.

## Smart Features (BME-001)
- POST /api/intelligence/analyze (requires login) builds operation snapshots from your data and generates alerts/recommendations via local SLM.
- Models load from MODELS_PATH via node-llama-cpp (GGUF). Set SLM_MODEL to pick a file.
- Results stored in smartAlerts table.
- Extend trend-analysis.ts and alert-narrator.ts for more BME-specific metrics.

## Development
- `npm run build`
- `npm test` (red tests live in __tests__/security)

## Spec
See `docs/specs/BME-001-local-smart-db.md`

This repo is the foundation for books-made-easy local. Backend first, per approved plan.
