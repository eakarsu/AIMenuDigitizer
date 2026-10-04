BEGIN;

CREATE TABLE IF NOT EXISTS governed_web_menu_routes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  menu_ref TEXT NOT NULL,
  location_ref TEXT NOT NULL,
  public_token UUID NOT NULL UNIQUE,
  live_version INTEGER,
  previous_version INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, menu_ref, location_ref)
);

COMMIT;
