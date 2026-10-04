BEGIN;

CREATE TABLE IF NOT EXISTS menu_source_objects (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  ingestion_ref TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
  sha256 CHAR(64) NOT NULL,
  bytes BYTEA NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length > 0 AND byte_length <= 10485760),
  extracted_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ingestion_ref),
  FOREIGN KEY (tenant_id, ingestion_ref) REFERENCES menu_ingestions(tenant_id, ingestion_ref) ON DELETE CASCADE
);

COMMIT;
