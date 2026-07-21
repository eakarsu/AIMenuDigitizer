BEGIN;

CREATE TABLE IF NOT EXISTS menu_ingestions (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, ingestion_ref TEXT NOT NULL,
  idempotency_key TEXT NOT NULL, source_type TEXT NOT NULL CHECK (source_type IN ('image','pdf')),
  source_checksum TEXT NOT NULL, object_ref TEXT NOT NULL, page_count INTEGER NOT NULL CHECK (page_count > 0),
  deskew_angle NUMERIC(6,2), ocr_confidence NUMERIC(5,4) CHECK (ocr_confidence BETWEEN 0 AND 1),
  layout_kind TEXT, handwriting BOOLEAN NOT NULL DEFAULT FALSE, correction_required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'ingested', created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ingestion_ref), UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS menu_versions (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, menu_ref TEXT NOT NULL, version INTEGER NOT NULL CHECK (version > 0),
  restaurant_ref TEXT NOT NULL, location_ref TEXT NOT NULL, channel TEXT NOT NULL, currency CHAR(3) NOT NULL,
  normalized_menu JSONB NOT NULL, availability JSONB NOT NULL DEFAULT '{}'::jsonb, source_ingestion_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'structured', effective_at TIMESTAMPTZ, supersedes_version INTEGER,
  created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (tenant_id, menu_ref, version)
);
CREATE TABLE IF NOT EXISTS menu_evidence_labels (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, menu_ref TEXT NOT NULL, menu_version INTEGER NOT NULL,
  item_ref TEXT NOT NULL, label_type TEXT NOT NULL CHECK (label_type IN ('allergen','ingredient','nutrition','dietary')),
  label_name TEXT NOT NULL, evidence_ref TEXT NOT NULL, evidence_version TEXT NOT NULL, evidence_checksum TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending', reviewed_by TEXT, reviewed_at TIMESTAMPTZ,
  UNIQUE (tenant_id, menu_ref, menu_version, item_ref, label_type, label_name, evidence_version)
);
CREATE TABLE IF NOT EXISTS menu_translations (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, menu_ref TEXT NOT NULL, menu_version INTEGER NOT NULL,
  locale TEXT NOT NULL, terminology_version TEXT NOT NULL, translated_menu JSONB NOT NULL, protected_names JSONB NOT NULL,
  round_trip_score NUMERIC(5,4) NOT NULL CHECK (round_trip_score BETWEEN 0 AND 1), review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT, reviewed_at TIMESTAMPTZ, UNIQUE (tenant_id, menu_ref, menu_version, locale)
);
CREATE TABLE IF NOT EXISTS menu_publications (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, menu_ref TEXT NOT NULL, menu_version INTEGER NOT NULL,
  channel TEXT NOT NULL, idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', scheduled_at TIMESTAMPTZ,
  availability JSONB NOT NULL DEFAULT '{}'::jsonb, provider_receipt TEXT, rollback_version INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ, last_error TEXT, deleted_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  conflict_details JSONB NOT NULL DEFAULT '[]'::jsonb, UNIQUE (tenant_id, channel, idempotency_key)
);
CREATE TABLE IF NOT EXISTS menu_workflow_audit (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, menu_ref TEXT NOT NULL, menu_version INTEGER,
  from_status TEXT, to_status TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL,
  reason TEXT NOT NULL, evidence JSONB NOT NULL DEFAULT '{}'::jsonb, correlation_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_publications_retry ON menu_publications (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_menu_audit_lookup ON menu_workflow_audit (tenant_id, menu_ref, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_audit_correlation ON menu_workflow_audit (tenant_id, menu_ref, correlation_id);
COMMIT;
