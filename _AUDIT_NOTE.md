# Audit Note — AIMenuDigitizer

Source audit: `_AUDIT/reports/batch_05.md` § 22 (TypeScript, 16 AI endpoints, controller + service + queue architecture)

## Original audit recommendations

### Missing AI endpoints
- `/dietary-filter-recommendations`
- `/cost-analysis`
- `/menu-seasonal-rotation`

### Missing non-AI features
- Multi-location menu management
- Order integration (popularity tracking)
- Staff permissions (kitchen / server / manager)
- Supplier cost tracking
- QR code menu delivery
- Guest dietary preference tracking
- POS integration

### Custom feature suggestions
- Vision-based menu intelligence (already partially live)
- Agentic menu optimization
- Streaming dietary compliance
- Multi-language menu automation
- Inventory-menu optimization
- Vertical integration (DoorDash, Uber Eats)

## Implemented in this pass
**Backlog-only.** This project has a substantive 3-tier architecture (route → controller → service + jobQueue) that requires coordinated changes across all three layers for each new endpoint. Per the audit-apply policy, mechanical additions here would need:

- A new service method on `OpenRouterService` in `services/openrouter.ts` (~60 lines each: prompt + DB persistence)
- A new controller in `controllers/aiController.ts` (~30 lines each)
- A new route registration in `routes/ai.ts`
- Coordination with the queued-job pattern (`enqueueJob` / `getJob`) for slow endpoints

The 16 existing endpoints already cover the core use case (OCR, allergens, calories, translation, pricing, recommendations, nutrition, scoring). Per "substantive projects → backlog-only" guidance, the deeper additions are deferred.

## Backlog (priority order)

### Mechanical (requires multi-file additions)
- `/ai/dietary-filter-recommendations` — service method using existing menu/item models; small extension over `/recommend-dishes`.
- `/ai/cost-analysis` — uses ingredient cost data; requires schema for ingredient costs (currently absent).
- `/ai/menu-seasonal-rotation` — straightforward over existing menu data.

### Needs creds / external SDK
- POS integration (Toast, Square, Clover)
- Delivery platform sync (DoorDash, Uber Eats Marketplace API)
- QR code generation (likely needs `qrcode` npm dep — out of scope per "no new SDK" rule)

### Needs product decision
- Multi-location data model (tenant + location hierarchy)
- Staff permissions matrix
- Supplier cost schema (units, conversions, vendor pricing)
- Guest dietary preference storage (PII / privacy)

## Apply pass 3 (frontend)

Verified the Vite/React/TS/Tailwind frontend already surfaces every AI
endpoint via `frontend/src/services/api.ts` `aiApi` helper:

- `AIAnalysisPage.tsx` → `/api/ai/analyze-image`, `/analyze-text`
- `AllergensPage.tsx` → `/api/ai/detect-allergens`
- `CaloriesPage.tsx` → `/api/ai/estimate-calories`
- `TranslationsPage.tsx` → `/api/ai/translate`
- `PriceOptimizerPage.tsx` → `/api/ai/optimize-price`
- `DishRecommenderPage.tsx` → `/api/ai/recommend-dishes`
- `NutritionHealthcarePage.tsx` → `/api/ai/nutrition-healthcare`
- `MenuEngineerScorePage.tsx` → `/api/ai/menu-engineer-score/:id`

Pass 2 was backlog-only for this project (no new BE endpoints), so no FE
gap to close.

Action: LEFT-AS-IS (FE already wired).

## Apply pass 4 (mechanical backlog)

Closed two of the three mechanical backlog items by extending the
3-tier architecture (service → controller → route) and adding two FE
pages. Skipped the third (`/cost-analysis`) because it requires an
ingredient-cost schema that does not exist yet.

### New endpoints

- `POST /api/ai/dietary-filter-recommendations` — given `menuId` and a
  list of `filters` (e.g. `vegan`, `gluten_free`), returns compliant
  items, items convertible with substitutions, and coverage gaps.
- `POST /api/ai/menu-seasonal-rotation` — given `menuId` and a `season`
  (and optional `region`), returns keep / retire / add lists with
  rationale and balance notes.

Both new methods on `OpenRouterService` reuse the existing
`makeRequest` + `parseJsonResponse` pattern and persist results in the
existing `ai_analysis` table. Both controllers explicitly 503 when
`OPENROUTER_API_KEY` is missing. Both routes are gated by
`authenticateToken` + `heavyAiLimiter`.

Pre-existing bug fixed as part of this pass: `services/openrouter.ts`
had a stray `}` that closed the class prematurely (line 815 in the
pre-existing file), making `analyzeMenuPdf` and `menuEngineerScore`
type-check failures. Removed the stray brace; the rest of the class
now type-checks cleanly. This was load-bearing for any new method on
the service to be reachable.

### New frontend pages

- `frontend/src/pages/DietaryFilterPage.tsx` — menu picker, filter
  toggles (vegan / vegetarian / gluten_free / dairy_free / nut_free /
  halal / kosher), notes box, structured render of compliant /
  convertible / gaps. Visible 503 handling via the toast system.
- `frontend/src/pages/SeasonalRotationPage.tsx` — menu picker, season
  select, optional region, structured render of keep / retire / add.

Wiring:
- `services/api.ts` — `aiApi.dietaryFilterRecommendations` and
  `aiApi.menuSeasonalRotation`.
- `App.tsx` — `/dietary-filters` and `/seasonal-rotation` routes.
- `components/Layout.tsx` — sidebar entries with `Filter` and `Leaf`
  icons.

### Smoke test

PASS. Started `npx ts-node src/index.ts` on port 3001; `POST
/api/ai/dietary-filter-recommendations` without a token returned 401
(route mounted, auth middleware executing). Cleaned up.

### Files touched

- `backend/src/services/openrouter.ts` (new methods + brace fix)
- `backend/src/controllers/aiController.ts`
- `backend/src/routes/ai.ts`
- `frontend/src/services/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/pages/DietaryFilterPage.tsx` (new)
- `frontend/src/pages/SeasonalRotationPage.tsx` (new)

### Remaining backlog

- Out-of-scope this pass: QR code dep (would require new SDK).
- [PRODUCT-DECISION] Guest dietary preference storage (PII) — explicit
  privacy/consent decision still required.

## Apply pass 5 (all backlog)

Closed five backlog items. New routes are mounted in `index.ts` alongside
existing routes; schemas are created on demand via `CREATE TABLE IF NOT
EXISTS` so no new migration script is required.

### New endpoints

- `GET/POST/DELETE /api/locations` — multi-location data model. PRODUCT-DECISION:
  per-user (tenant) ownership; menus.location_id added via `ALTER TABLE …
  IF NOT EXISTS`.
- `GET /api/staff/roles`, `GET/POST/DELETE /api/staff/assignments` — RBAC
  matrix. PRODUCT-DECISION: 4-tier admin / manager / server / kitchen.
- `GET/POST /api/ingredient-costs`, `POST /api/ingredient-costs/menu-item-link`,
  `GET /api/ingredient-costs/analysis/:menuId` — ingredient cost schema +
  deterministic margin analysis.
- `POST /api/ai/cost-analysis` — AI variant returning substitution and
  supplier-consolidation recommendations. 503 on missing
  `OPENROUTER_API_KEY`.
- `GET /api/integrations/status`, `POST /api/integrations/:provider/sync-menu`,
  `POST /api/integrations/:provider/import-orders` — Toast / Square /
  Clover / DoorDash / Uber Eats. NEEDS-CREDS gated.

### Schema additions (created on demand)

- `locations(id, user_id, name, address, city, country, timezone, created_at)`
- `staff_assignments(id, user_id, location_id, role, assigned_by, created_at)`
- `ingredients(id, user_id, name, unit, cost_per_unit, vendor, ...)`
- `menu_item_ingredients(id, menu_item_id, ingredient_id, quantity_per_serving)`
- `ALTER TABLE menus ADD COLUMN IF NOT EXISTS location_id`

### New frontend pages

- `frontend/src/pages/LocationsPage.tsx`
- `frontend/src/pages/StaffPage.tsx`
- `frontend/src/pages/IngredientCostsPage.tsx`
- `frontend/src/pages/AICostAnalysisPage.tsx`
- `frontend/src/pages/IntegrationsPage.tsx`

`services/api.ts` extended with `locationsApi`, `staffApi`, `ingredientsApi`,
`integrationsApi`, plus `aiApi.costAnalysis`. `App.tsx` and
`components/Layout.tsx` updated.

### Smoke test

**PASS.** Started `npx ts-node src/index.ts` on port 3001. After registering
and logging in:

- `GET /api/staff/roles` → 200 with the 4-tier permissions map
- `GET /api/integrations/status` → 200 with all 5 providers `not configured`
  + per-provider `missing` arrays
- `POST /api/ai/cost-analysis` (with key set, no menu items) → 404 "No menu
  items found for this menu" — correct path through the 503 / data /
  upstream-API gates
- `POST /api/locations` (`{"name":"Main"}`) → 201, returned with id
- `POST /api/ingredient-costs` (`{"name":"flour","unit":"g","cost_per_unit":0.0012}`) → 201

`npx tsc --noEmit` clean (only pre-existing unused-import warnings).

### Files touched

- `backend/src/routes/locations.ts` (new)
- `backend/src/routes/staff.ts` (new)
- `backend/src/routes/ingredientCosts.ts` (new)
- `backend/src/routes/aiCostAnalysis.ts` (new)
- `backend/src/routes/integrations.ts` (new)
- `backend/src/index.ts` (5 new `app.use` lines)
- `frontend/src/services/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/pages/LocationsPage.tsx` (new)
- `frontend/src/pages/StaffPage.tsx` (new)
- `frontend/src/pages/IngredientCostsPage.tsx` (new)
- `frontend/src/pages/AICostAnalysisPage.tsx` (new)
- `frontend/src/pages/IntegrationsPage.tsx` (new)

### Remaining backlog after pass 5

- [PRODUCT-DECISION] Guest dietary preference storage (PII / privacy).
- Out-of-scope this pass: QR code dep (would require new SDK).
