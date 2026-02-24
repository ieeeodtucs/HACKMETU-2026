/**
 * Vulnerability Scan Logic
 *
 * Agent'a dpkg -l gönderir, sonucu alınca CVE veritabanıyla eşleştirir.
 * Versiyon karşılaştırması: dpkg epoch:upstream-debian formatını parse edip
 * NVD version_lt / version_lte ile karşılaştırır.
 */

import { pool } from "./db.js";
import { store, type VulnScanResult, type VulnEntry } from "./store.js";

// ===== Debian version parsing =====
// dpkg versiyonları: [epoch:]upstream[-debian_revision]
// Örnekler: 1:3.6.1-2, 2.36.1-8+deb12u2, 5.10.0-30-amd64

interface ParsedVersion {
  epoch: number;
  upstream: string;
  debian: string;
}

function parseDebianVersion(ver: string): ParsedVersion {
  let epoch = 0;
  let rest = ver;

  // Epoch
  const colonIdx = rest.indexOf(":");
  if (colonIdx !== -1) {
    epoch = parseInt(rest.slice(0, colonIdx)) || 0;
    rest = rest.slice(colonIdx + 1);
  }

  // Debian revision (son - den sonrası)
  let upstream = rest;
  let debian = "";
  const lastDash = rest.lastIndexOf("-");
  if (lastDash !== -1) {
    upstream = rest.slice(0, lastDash);
    debian = rest.slice(lastDash + 1);
  }

  return { epoch, upstream, debian };
}

// Upstream versiyonu NVD versiyonuyla karşılaştır
// Sadece upstream kısmını alıp numeric segmentlere bölerek karşılaştırır
function extractUpstreamVersion(debVer: string): string {
  const parsed = parseDebianVersion(debVer);
  return parsed.upstream;
}

// Genel versiyon karşılaştırma (semver-benzeri)
// -1: a < b, 0: a == b, 1: a > b
function compareVersions(a: string, b: string): number {
  // Sadece rakam ve noktaları al, harfleri ayır
  const segA = a.split(/[.\-+~]/).filter(Boolean);
  const segB = b.split(/[.\-+~]/).filter(Boolean);

  const maxLen = Math.max(segA.length, segB.length);
  for (let i = 0; i < maxLen; i++) {
    const sa = segA[i] || "0";
    const sb = segB[i] || "0";

    const na = parseInt(sa);
    const nb = parseInt(sb);

    // Her ikisi de sayıysa numerik karşılaştır
    if (!isNaN(na) && !isNaN(nb)) {
      if (na < nb) return -1;
      if (na > nb) return 1;
      // Sayılar eşitse string olarak da karşılaştır (1a vs 1b gibi)
      if (sa !== sb) {
        return sa < sb ? -1 : 1;
      }
    } else {
      // String karşılaştırma
      if (sa < sb) return -1;
      if (sa > sb) return 1;
    }
  }
  return 0;
}

// Paket versiyonu CVE'nin etkilediği aralıkta mı?
function isVersionAffected(
  pkgVersion: string,
  versionLt: string | null,
  versionLte: string | null,
  versionStart: string | null,
  versionValue: string | null
): boolean {
  const upstream = extractUpstreamVersion(pkgVersion);

  // Exact version match
  if (versionValue && versionValue !== "0") {
    if (compareVersions(upstream, versionValue) === 0) return true;
  }

  // version_lt: affected if pkg < version_lt
  if (versionLt) {
    const cmp = compareVersions(upstream, versionLt);
    if (cmp < 0) {
      // Start version check
      if (versionStart) {
        return compareVersions(upstream, versionStart) >= 0;
      }
      return true;
    }
  }

  // version_lte: affected if pkg <= version_lte
  if (versionLte) {
    const cmp = compareVersions(upstream, versionLte);
    if (cmp <= 0) {
      if (versionStart) {
        return compareVersions(upstream, versionStart) >= 0;
      }
      return true;
    }
  }

  // Eğer sadece version_value varsa ve match olmadıysa, default_status "affected" ise etkilenmiş sayılabilir
  // Ama false positive'i azaltmak için strict davranıyoruz
  return false;
}

// ===== dpkg -l parse =====
function parseDpkgOutput(raw: string): Array<{ name: string; version: string }> {
  const packages: Array<{ name: string; version: string }> = [];
  const lines = raw.split("\n");

  for (const line of lines) {
    const match = line.match(/^ii\s+(\S+)\s+(\S+)/);
    if (match) {
      packages.push({
        name: match[1].split(":")[0], // arch suffix kaldır
        version: match[2],
      });
    }
  }
  return packages;
}

// ===== Arama terimleri oluştur =====
function buildSearchTerms(pkgList: Array<{ name: string; version: string }>): Map<string, string> {
  const searchMap = new Map<string, string>();

  for (const pkg of pkgList) {
    const name = pkg.name.toLowerCase();
    searchMap.set(name, pkg.name);

    // lib prefix kaldır
    if (name.startsWith("lib")) {
      const stripped = name.slice(3);
      searchMap.set(stripped, pkg.name);
      const noDigit = stripped.replace(/[0-9.]+$/, "");
      if (noDigit.length >= 2) searchMap.set(noDigit, pkg.name);
    }

    // -dev, -common vb. suffix kaldır
    const base = name.replace(/-(dev|common|bin|utils|data|doc|dbg|lib|core|modules|plugins|tools)$/, "");
    if (base !== name && base.length >= 2) searchMap.set(base, pkg.name);

    // Sondaki versiyon numarasını kaldır
    const noVer = name.replace(/[0-9.]+$/, "");
    if (noVer !== name && noVer.length >= 2) searchMap.set(noVer, pkg.name);
  }

  return searchMap;
}

// ===== Ana scan fonksiyonu =====
export async function performVulnScan(
  agentId: string,
  dpkgOutput: string
): Promise<VulnScanResult> {
  const startedAt = new Date().toISOString();

  // Scanning durumunu kaydet
  const scanning: VulnScanResult = {
    agentId,
    status: "scanning",
    startedAt,
    scanned: 0,
    vulnerabilities: [],
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  };
  store.setVulnScan(agentId, scanning);

  try {
    const pkgList = parseDpkgOutput(dpkgOutput);
    if (pkgList.length === 0) {
      const result: VulnScanResult = {
        ...scanning,
        status: "completed",
        completedAt: new Date().toISOString(),
        scanned: 0,
      };
      store.setVulnScan(agentId, result);
      return result;
    }

    const searchMap = buildSearchTerms(pkgList);
    const searchTerms = [...searchMap.keys()].filter((t) => t.length >= 2);

    if (searchTerms.length === 0) {
      const result: VulnScanResult = {
        ...scanning,
        status: "completed",
        completedAt: new Date().toISOString(),
        scanned: pkgList.length,
      };
      store.setVulnScan(agentId, result);
      return result;
    }

    // Batch query — exact product name match
    const conditions = searchTerms
      .map((_, i) => `lower(a.product) = $${i + 1}`)
      .join(" OR ");

    const dbResult = await pool.query(
      `SELECT
         c.cve_id, c.title, c.description, c.severity, c.cvss_score,
         c.date_published, c.cwe_id,
         a.vendor, a.product, a.version_lt, a.version_lte, a.version_value,
         a.version_start, a.default_status
       FROM cve_affected a
       JOIN cves c ON c.cve_id = a.cve_id
       WHERE ${conditions}
       ORDER BY c.cvss_score DESC NULLS LAST
       LIMIT 2000`,
      searchTerms
    );

    // Her CVE row'u için: hangi pakete eşleşti? versiyon etkileniyor mu?
    const vulnMap = new Map<string, VulnEntry>(); // cve_id -> best match

    for (const row of dbResult.rows) {
      const product = row.product.toLowerCase();

      // Bu product hangi dpkg paketine eşleşiyor?
      let matchedPkg: { name: string; version: string } | undefined;
      for (const [term, origName] of searchMap) {
        if (product === term || product.includes(term) || term.includes(product)) {
          matchedPkg = pkgList.find((p) => p.name === origName);
          if (matchedPkg) break;
        }
      }

      if (!matchedPkg) continue;

      // Versiyon kontrolü — etkileniyor mu?
      const affected = isVersionAffected(
        matchedPkg.version,
        row.version_lt,
        row.version_lte,
        row.version_start,
        row.version_value
      );

      // default_status "affected" ve versiyon bilgisi yoksa → skip (çok fazla false positive)
      const hasVersionInfo = row.version_lt || row.version_lte || row.version_value;
      if (!hasVersionInfo && row.default_status === "affected") {
        // Versiyon bilgisi olmayan "affected" durumları skip
        continue;
      }

      if (!affected && hasVersionInfo) continue;
      if (!affected && !hasVersionInfo) continue;

      // Daha önce bu CVE eklenmişse, daha yüksek CVSS olanı tut
      const existing = vulnMap.get(row.cve_id);
      if (existing && (existing.cvss_score || 0) >= (row.cvss_score || 0)) continue;

      vulnMap.set(row.cve_id, {
        cve_id: row.cve_id,
        severity: row.severity || "UNKNOWN",
        cvss_score: row.cvss_score,
        title: row.title || "",
        description: row.description?.slice(0, 400) || "",
        affected_product: row.product,
        affected_vendor: row.vendor,
        version_lt: row.version_lt,
        version_lte: row.version_lte,
        matched_package: matchedPkg.name,
        matched_version: matchedPkg.version,
        date_published: row.date_published,
      });
    }

    const vulnerabilities = [...vulnMap.values()];

    // Severity'ye göre sırala
    const severityOrder: Record<string, number> = {
      CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0,
    };
    vulnerabilities.sort(
      (a, b) => (severityOrder[b.severity] ?? -1) - (severityOrder[a.severity] ?? -1)
    );

    const result: VulnScanResult = {
      agentId,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      scanned: pkgList.length,
      vulnerabilities,
      summary: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter((v) => v.severity === "CRITICAL").length,
        high: vulnerabilities.filter((v) => v.severity === "HIGH").length,
        medium: vulnerabilities.filter((v) => v.severity === "MEDIUM").length,
        low: vulnerabilities.filter((v) => v.severity === "LOW").length,
      },
    };

    store.setVulnScan(agentId, result);
    return result;
  } catch (err: any) {
    const errorResult: VulnScanResult = {
      agentId,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      scanned: 0,
      error: err.message || "Scan failed",
      vulnerabilities: [],
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    };
    store.setVulnScan(agentId, errorResult);
    return errorResult;
  }
}
