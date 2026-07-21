# Operator runbook

Install dependencies explicitly with `npm ci` in `backend/` and `frontend/`. Review and apply `backend/migrations/003_menu_workflow.sql` using `DATABASE_URL=... ./scripts/migrate.sh`; startup never installs, seeds, migrates, kills ports, or starts PostgreSQL. Copy `.env.example`, set a unique 32+ character `JWT_SECRET`, keep experimental routes disabled, then run `./start.sh`.

OCR output below 0.90 confidence or marked handwriting stays in correction review. All safety labels need supplier/restaurant evidence. Publication needs independent review, a provider receipt, and a rollback version. POS/KDS/marketplace/provider execution remains blocked until real credentials, sandbox contract fixtures, deletion/conflict tests, and an operator approval are present. On retry exhaustion, stop publication, retain the last published version, and reconcile receipts manually.
