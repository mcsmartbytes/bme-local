# BME-001: books-made-easy local — Smart Database Backend

**Status**: Ready for local production

**Spec Prefix**: BME-

## Intent
Build the backend for a local-only "books-made-easy local" using its own smart database (LibSQL + Drizzle), following the ops-sense pattern.

Key elements:
- Isolated per-bookkeeper DBs
- SLM (small language model) loaded from existing local models directory
- First intelligent features: analysis + recommendations, operation watching/monitoring, suggestions to correct issues, notifications

Bookkeeper runs the instance locally and connects directly (no Supabase, no Vercel cloud).

## Constraints
- Local only (file:local.db primary)
- SLM from `C:\Users\Michelle\Models` (WSL: /mnt/c/Users/Michelle/Models). No Ollama required.
- Auth uses JWT + bcryptjs (local)
- No references to "AI", "LLM", "Ollama", "Anthropic" etc in source code/comments (use "intelligence", "analysis", "smart alerts")
- Follow FolkTech rules + red tests for security categories
- Easy wrapper for run + connect

## Acceptance Criteria
- Drizzle + LibSQL setup with local.db fallback
- Schema includes core BME tables + smart tables (snapshots, alerts, embeddings)
- /api/db/init seeds a local bookkeeper + sample data
- /api/intelligence/analyze builds snapshots from data, runs deterministic trends, uses SLM to narrate alerts/recommendations, stores in smartAlerts
- SLM client loads/uses models from the specified dir
- Easy wrapper starts server and provides simple connect instructions
- Red tests (at minimum CAT7) pass
- `npm run build` clean
- README documents run, connect, models path, first run steps

## Out-of-Scope (initial)
- Full port of all BME features
- Billing/monetization
- Hosted/multi-tenant cloud
- Mobile apps
- Production packaging

## Open Questions
- Preferred concrete SLM runtime (node-llama-cpp, xenova/transformers, other) for GGUF/models in the dir?
- Depth of initial schema (more tables from original BME)?
- Basic UI pages now or backend-first?

## Related
- Modeled on: ops-sense/apps/ops-made-easy
- Parent plan in session history
