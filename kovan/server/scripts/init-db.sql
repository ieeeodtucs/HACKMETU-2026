-- CVE database schema
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CVE ana tablo
CREATE TABLE IF NOT EXISTS cves (
  cve_id         TEXT PRIMARY KEY,
  state          TEXT NOT NULL DEFAULT 'PUBLISHED',
  date_published TIMESTAMPTZ,
  date_updated   TIMESTAMPTZ,
  title          TEXT,
  description    TEXT,
  severity       TEXT,
  cvss_score     REAL,
  cvss_vector    TEXT,
  cwe_id         TEXT,
  cwe_name       TEXT,
  refs           TEXT[]
);

-- Etkilenen urunler tablosu
CREATE TABLE IF NOT EXISTS cve_affected (
  id             SERIAL PRIMARY KEY,
  cve_id         TEXT NOT NULL REFERENCES cves(cve_id) ON DELETE CASCADE,
  vendor         TEXT NOT NULL DEFAULT '',
  product        TEXT NOT NULL DEFAULT '',
  version_value  TEXT,
  version_lt     TEXT,
  version_lte    TEXT,
  version_start  TEXT,
  version_type   TEXT,
  default_status TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cve_affected_cve_id ON cve_affected(cve_id);
CREATE INDEX IF NOT EXISTS idx_cve_affected_product_trgm ON cve_affected USING GIN (lower(product) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cve_affected_vendor_trgm ON cve_affected USING GIN (lower(vendor) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cve_affected_product_lower ON cve_affected(lower(product));
CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity);
CREATE INDEX IF NOT EXISTS idx_cves_cvss ON cves(cvss_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cves_description_trgm ON cves USING GIN (lower(description) gin_trgm_ops);
