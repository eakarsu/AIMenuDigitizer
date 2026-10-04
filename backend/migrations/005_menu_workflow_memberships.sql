BEGIN;

-- A user may work in their own menu workspace automatically. Shared workspaces
-- require an explicit administrative grant so a different reviewer can approve
-- a menu version without accepting an arbitrary tenant header.
CREATE TABLE IF NOT EXISTS menu_workflow_memberships (
  tenant_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS menu_workflow_memberships_user_idx
  ON menu_workflow_memberships(user_id, active);

COMMIT;
