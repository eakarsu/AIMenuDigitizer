BEGIN;

-- Publication gate for the public QR/HTML menu endpoint.
-- A menu is only served to anonymous visitors after an explicit, evidenced
-- publish action (see POST /api/menus/:id/publication). The default keeps every
-- existing menu private so nothing becomes public implicitly.
ALTER TABLE menus ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'private';
ALTER TABLE menus ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS publication_receipt TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS publication_rollback_version INTEGER;

CREATE INDEX IF NOT EXISTS idx_menus_publication_status ON menus (publication_status);

COMMIT;
