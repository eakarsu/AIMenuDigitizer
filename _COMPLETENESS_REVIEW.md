# Completeness Review: AIMenuDigitizer

- **Review date:** 2026-07-20
- **Assessment basis:** Static review plus isolated migrations/demo fixtures, assigned-port startup, provisioned login, authenticated session verification, policy tests, and backend/frontend builds.

## Classification

**Functional but incomplete**

## Verdict

This is a substantive but unfinished commerce/local operations application: 124 project-owned source files and 2 manifest(s) expose a coherent surface, but the source does not demonstrate a production-complete AIMenu Digitizer workflow.

## Why it is not complete

- 27 files are explicitly named as gap/backlog surfaces, so page and route counts overstate implemented product capability.
- 24 project-owned files contain direct provider/chat-completion markers; generic model calls are not a substitute for typed domain tools, grounded evidence, deterministic rules, or evaluations.
- 45 files contain mock, sample, placeholder, simulated, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- No explicit schema or migration evidence was found for durable, versioned domain state.
- No recognizable project-owned automated tests were found for the primary workflow.
- No checked-in CI workflow was found to continuously verify builds, tests, migrations, and security checks.
- No environment example/template was found, leaving required configuration and secret boundaries undocumented.

## Needed features

1. Implement image/PDF menu ingestion with deskewing, OCR confidence, section/item/modifier reconstruction, currency and price validation, and an operator correction queue.
2. Maintain normalized menus by restaurant/location/channel with version history, scheduled publishing, availability windows, and rollback.
3. Ground allergen, ingredient, nutrition, and dietary labels in supplier or restaurant evidence; require review instead of inferring safety from an LLM.
4. Add terminology-aware translation with protected dish names, locale/currency formatting, reviewer approval, and round-trip quality checks.
5. Integrate POS, online ordering, KDS, delivery marketplaces, and print/web exports through idempotent sync with conflict and deletion handling.
6. Test low-quality scans, handwriting, multi-column layouts, modifiers, duplicate items, allergen conflicts, and integration retries in CI.

## Risks or launch blockers

- Payment, inventory, scheduling, and fulfillment divergence can cause direct customer and financial harm.
- Seeded records and generic AI recommendations do not prove real partner or operational execution.
- Destructive demo fixtures remain an explicit non-production operation and must only target disposable databases.
- Real OCR, supplier evidence, and publication providers remain fail-closed and unverified.

## Evidence inspected

- `README.md` — inspected project-owned structure or implementation evidence.
- `backend/package.json` — inspected project-owned structure or implementation evidence.
- `backend/src/controllers/index.ts` — inspected project-owned structure or implementation evidence.
- `backend/src/routes/gap-dietary-filter-recommendations.ts` — inspected project-owned structure or implementation evidence.
- `start.sh` — inspected project-owned structure or implementation evidence.
- `backend/src/controllers/aiController.ts` — inspected project-owned structure or implementation evidence.

## Recommended next action

Choose one production commerce/local operations journey, connect its authoritative systems, define measurable acceptance tests, and close its data, permission, failure, and operational gaps before adding screens.

## Implementation progress

1. Implemented a validated image/PDF ingestion contract with source checksum, deskew/confidence bounds, layout/handwriting metadata, correction-queue flagging, and deterministic menu/price/modifier validators; OCR execution itself remains fail-closed pending real scan fixtures and an approved OCR provider.
2. Added durable tenant-scoped ingestion, restaurant/location/channel menu versions, availability, scheduled publication, rollback, idempotency and row-locked state transitions in `003_menu_workflow.sql` and the authenticated workflow API.
3. Added versioned supplier/restaurant evidence records and a policy that rejects inferred safety labels; independent compliance review is mandatory before approval.
4. Added protected-name, locale/currency and round-trip thresholds plus durable translation review state; external translation remains disabled until credentials and reviewer fixtures exist.
5. Added idempotent publication delivery state with receipts, retries, conflicts, deletions and rollback; POS/KDS/ordering/marketplace execution remains quarantined until credentials and provider contracts are available.
6. Added dependency-free policy/edge/failure tests, CI build/test/shell gates, safe configuration, explicit migrations and a nondestructive operator runbook covering low confidence, handwriting, duplicates, labels and retry boundaries.

## Runtime verification (2026-07-20)

- `start.sh` launched the built backend and Vite UI on assigned API/UI ports `5980/5981` with PostgreSQL `55580`; it used no listener-port defaults and stopped all owned processes.
- Gated demo seeding used injected credentials, then login and the persisted `/api/auth/me` session check passed.
- Five menu-workflow tests, TypeScript compilation, and the Vite production build passed.
