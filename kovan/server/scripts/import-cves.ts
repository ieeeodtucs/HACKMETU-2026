/**
 * CVE JSON Import Script
 *
 * cves/2025 ve cves/2026 klasorlerindeki tum CVE JSON dosyalarini
 * PostgreSQL'e batch INSERT ile aktarir.
 *
 * Kullanim: cd server && npx tsx scripts/import-cves.ts
 */

import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import pg from "pg";

const { Pool } = pg;

// ===== Config =====
const CVE_DIRS = [
  join(import.meta.dirname!, "..", "..", "cves", "2025"),
  join(import.meta.dirname!, "..", "..", "cves", "2026"),
];
const BATCH_SIZE = 500;
const DB_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/kovan";

// ===== Types =====
interface CveRow {
  cve_id: string;
  state: string;
  date_published: string | null;
  date_updated: string | null;
  title: string | null;
  description: string | null;
  severity: string | null;
  cvss_score: number | null;
  cvss_vector: string | null;
  cwe_id: string | null;
  cwe_name: string | null;
  refs: string[];
}

interface AffectedRow {
  cve_id: string;
  vendor: string;
  product: string;
  version_value: string | null;
  version_lt: string | null;
  version_lte: string | null;
  version_start: string | null;
  version_type: string | null;
  default_status: string | null;
}

// ===== JSON Parsing =====
function parseCveJson(raw: any): { cve: CveRow; affected: AffectedRow[] } | null {
  try {
    const meta = raw.cveMetadata;
    if (!meta?.cveId) return null;

    const cna = raw.containers?.cna;
    if (!cna) return null;

    // Description
    const descObj = cna.descriptions?.[0];
    const description = descObj?.value || null;

    // Title
    const title = cna.title || null;

    // CVSS - try v3.1 first, then v4.0
    let cvss_score: number | null = null;
    let cvss_vector: string | null = null;
    let severity: string | null = null;

    for (const m of cna.metrics || []) {
      if (m.cvssV3_1) {
        cvss_score = m.cvssV3_1.baseScore ?? null;
        cvss_vector = m.cvssV3_1.vectorString ?? null;
        severity = m.cvssV3_1.baseSeverity ?? null;
        break;
      }
      if (m.cvssV4_0) {
        cvss_score = m.cvssV4_0.baseScore ?? null;
        cvss_vector = m.cvssV4_0.vectorString ?? null;
        severity = m.cvssV4_0.baseSeverity ?? null;
        break;
      }
    }

    // Severity from ADP if not in CNA
    if (!severity) {
      for (const adp of raw.containers?.adp || []) {
        for (const m of adp.metrics || []) {
          if (m.cvssV3_1) {
            cvss_score = cvss_score ?? m.cvssV3_1.baseScore ?? null;
            cvss_vector = cvss_vector ?? m.cvssV3_1.vectorString ?? null;
            severity = m.cvssV3_1.baseSeverity ?? null;
            break;
          }
        }
        if (severity) break;
      }
    }

    // CWE
    let cwe_id: string | null = null;
    let cwe_name: string | null = null;
    const prob = cna.problemTypes?.[0]?.descriptions?.[0];
    if (prob) {
      cwe_id = prob.cweId || null;
      cwe_name = prob.description || null;
    }

    // References
    const refs: string[] = (cna.references || [])
      .map((r: any) => r.url)
      .filter(Boolean);

    const cve: CveRow = {
      cve_id: meta.cveId,
      state: meta.state || "PUBLISHED",
      date_published: meta.datePublished || null,
      date_updated: meta.dateUpdated || null,
      title,
      description,
      severity: severity?.toUpperCase() || null,
      cvss_score,
      cvss_vector,
      cwe_id,
      cwe_name,
      refs,
    };

    // Affected products
    const affected: AffectedRow[] = [];
    for (const a of cna.affected || []) {
      const vendor = a.vendor || "";
      const product = a.product || "";
      const defaultStatus = a.defaultStatus || null;

      const versions = a.versions || [];
      if (versions.length === 0) {
        // No version info, still record the product
        affected.push({
          cve_id: meta.cveId,
          vendor,
          product,
          version_value: null,
          version_lt: null,
          version_lte: null,
          version_start: null,
          version_type: null,
          default_status: defaultStatus,
        });
      } else {
        for (const v of versions) {
          if (v.status !== "affected") continue;

          affected.push({
            cve_id: meta.cveId,
            vendor,
            product,
            version_value: !v.lessThan && !v.lessThanOrEqual ? v.version || null : null,
            version_lt: v.lessThan || null,
            version_lte: v.lessThanOrEqual || null,
            version_start: v.lessThan || v.lessThanOrEqual ? v.version || null : null,
            version_type: v.versionType || null,
            default_status: defaultStatus,
          });
        }
      }
    }

    return { cve, affected };
  } catch {
    return null;
  }
}

// ===== Collect all JSON file paths =====
async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (entry.name.startsWith("CVE-") && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

// ===== Batch INSERT =====
async function insertCveBatch(pool: pg.Pool, cves: CveRow[]) {
  if (cves.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < cves.length; i++) {
    const c = cves[i];
    const offset = i * 12;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12})`
    );
    values.push(
      c.cve_id, c.state, c.date_published, c.date_updated,
      c.title, c.description, c.severity, c.cvss_score,
      c.cvss_vector, c.cwe_id, c.cwe_name, c.refs
    );
  }

  await pool.query(
    `INSERT INTO cves (cve_id, state, date_published, date_updated, title, description, severity, cvss_score, cvss_vector, cwe_id, cwe_name, refs)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (cve_id) DO UPDATE SET
       state = EXCLUDED.state,
       date_published = EXCLUDED.date_published,
       date_updated = EXCLUDED.date_updated,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       severity = EXCLUDED.severity,
       cvss_score = EXCLUDED.cvss_score,
       cvss_vector = EXCLUDED.cvss_vector,
       cwe_id = EXCLUDED.cwe_id,
       cwe_name = EXCLUDED.cwe_name,
       refs = EXCLUDED.refs`,
    values
  );
}

async function insertAffectedBatch(pool: pg.Pool, rows: AffectedRow[]) {
  if (rows.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const offset = i * 9;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9})`
    );
    values.push(
      r.cve_id, r.vendor, r.product,
      r.version_value, r.version_lt, r.version_lte,
      r.version_start, r.version_type, r.default_status
    );
  }

  await pool.query(
    `INSERT INTO cve_affected (cve_id, vendor, product, version_value, version_lt, version_lte, version_start, version_type, default_status)
     VALUES ${placeholders.join(",")}`,
    values
  );
}

// ===== Main =====
async function main() {
  console.log("=== CVE Import Basladi ===\n");

  const pool = new Pool({ connectionString: DB_URL });

  // Clean existing data for re-import
  console.log("Mevcut veriler temizleniyor...");
  await pool.query("DELETE FROM cve_affected");
  await pool.query("DELETE FROM cves");

  // Collect files
  let allFiles: string[] = [];
  for (const dir of CVE_DIRS) {
    try {
      const files = await collectFiles(dir);
      console.log(`${dir}: ${files.length} dosya bulundu`);
      allFiles.push(...files);
    } catch (e: any) {
      console.log(`${dir}: atlanıyor (${e.message})`);
    }
  }

  console.log(`\nToplam: ${allFiles.length} CVE dosyasi\n`);

  let cveBatch: CveRow[] = [];
  let affectedBatch: AffectedRow[] = [];
  let totalCves = 0;
  let totalAffected = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < allFiles.length; i++) {
    try {
      const content = await readFile(allFiles[i], "utf-8");
      const json = JSON.parse(content);
      const result = parseCveJson(json);

      if (!result) {
        skipped++;
        continue;
      }

      // Skip REJECTED
      if (result.cve.state === "REJECTED") {
        skipped++;
        continue;
      }

      cveBatch.push(result.cve);
      affectedBatch.push(...result.affected);

      // Flush batch - CVE veya affected cok buyurse flush
      if (cveBatch.length >= BATCH_SIZE || affectedBatch.length >= 2000) {
        await insertCveBatch(pool, cveBatch);
        // affected batch'i 2000'lik parcalara bol (PG param limiti)
        for (let j = 0; j < affectedBatch.length; j += 2000) {
          await insertAffectedBatch(pool, affectedBatch.slice(j, j + 2000));
        }
        totalCves += cveBatch.length;
        totalAffected += affectedBatch.length;
        cveBatch = [];
        affectedBatch = [];

        // Progress
        const pct = ((i / allFiles.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r  [${pct}%] ${totalCves} CVE, ${totalAffected} affected | ${elapsed}s`);
      }
    } catch {
      skipped++;
    }
  }

  // Flush remaining
  if (cveBatch.length > 0) {
    await insertCveBatch(pool, cveBatch);
    for (let j = 0; j < affectedBatch.length; j += 2000) {
      await insertAffectedBatch(pool, affectedBatch.slice(j, j + 2000));
    }
    totalCves += cveBatch.length;
    totalAffected += affectedBatch.length;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n\n=== Import Tamamlandi ===`);
  console.log(`  CVE:      ${totalCves}`);
  console.log(`  Affected: ${totalAffected}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Sure:     ${elapsed}s\n`);

  // Verify
  const cveCount = await pool.query("SELECT count(*) FROM cves");
  const affCount = await pool.query("SELECT count(*) FROM cve_affected");
  const sevCount = await pool.query("SELECT severity, count(*) as cnt FROM cves WHERE severity IS NOT NULL GROUP BY severity ORDER BY cnt DESC");

  console.log("=== Dogrulama ===");
  console.log(`  cves tablosu:         ${cveCount.rows[0].count}`);
  console.log(`  cve_affected tablosu: ${affCount.rows[0].count}`);
  console.log(`  Severity dagilimi:`);
  for (const row of sevCount.rows) {
    console.log(`    ${row.severity}: ${row.cnt}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Import hatasi:", err);
  process.exit(1);
});
