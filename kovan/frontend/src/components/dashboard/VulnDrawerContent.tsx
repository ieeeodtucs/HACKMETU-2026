import { useState } from "react";
import type { VulnScanResult } from "../../api";
import { severityColor, severityBg } from "./helpers";
import {
  SpinnerGapIcon,
  WarningCircleIcon,
  ShieldCheckIcon,
  PackageIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";

export function VulnDrawerContent({
  scan,
  scanning,
}: {
  scan: VulnScanResult | null;
  scanning: boolean;
  onTrigger: () => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredVulns = scan?.vulnerabilities.filter((v) => {
    if (filter !== "ALL" && v.severity !== filter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        v.cve_id.toLowerCase().includes(q) ||
        (v.matched_package || "").toLowerCase().includes(q) ||
        (v.affected_product || "").toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q)
      );
    }
    return true;
  }) || [];

  return (
    <div className="vuln-panel expanded" style={{ border: "none", borderRadius: 0, margin: 0, background: "transparent" }}>
      <div className="vuln-body" style={{ maxHeight: "none" }}>
        {!scan && !scanning && (
          <div className="vuln-empty">
            <ShieldCheckIcon size={40} weight="duotone" />
            <span>Henüz zafiyet taraması yapılmadı</span>
            <span className="vuln-empty-sub">
              "Tara" butonuna basarak makinedeki tüm paketleri CVE veritabanıyla karşılaştırın
            </span>
          </div>
        )}

        {scanning && (
          <div className="vuln-scanning">
            <SpinnerGapIcon size={32} className="si-run" />
            <span>Paketler taranıyor ve CVE eşleştirmesi yapılıyor...</span>
            <span className="vuln-scanning-sub">Bu işlem birkaç saniye sürebilir</span>
          </div>
        )}

        {scan && scan.status === "error" && (
          <div className="vuln-error">
            <WarningCircleIcon size={32} weight="fill" />
            <span>Tarama hatası: {scan.error}</span>
          </div>
        )}

        {scan && scan.status === "completed" && (
          <>
            <div className="vuln-summary">
              <div className="vuln-summary-item">
                <PackageIcon size={16} />
                <div>
                  <span className="vuln-sum-val">{scan.scanned}</span>
                  <span className="vuln-sum-label">Paket</span>
                </div>
              </div>
              <div className="vuln-summary-item vuln-sum-critical">
                <span className="vuln-sum-val">{scan.summary.critical}</span>
                <span className="vuln-sum-label">Kritik</span>
              </div>
              <div className="vuln-summary-item vuln-sum-high">
                <span className="vuln-sum-val">{scan.summary.high}</span>
                <span className="vuln-sum-label">Yüksek</span>
              </div>
              <div className="vuln-summary-item vuln-sum-medium">
                <span className="vuln-sum-val">{scan.summary.medium}</span>
                <span className="vuln-sum-label">Orta</span>
              </div>
              <div className="vuln-summary-item vuln-sum-low">
                <span className="vuln-sum-val">{scan.summary.low}</span>
                <span className="vuln-sum-label">Düşük</span>
              </div>
            </div>

            {scan.summary.total > 0 && (
              <>
                <div className="vuln-filters">
                  <div className="vuln-filter-tabs">
                    {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                      <button
                        key={sev}
                        className={`vuln-filter-tab ${filter === sev ? "active" : ""}`}
                        onClick={() => setFilter(sev)}
                        style={filter === sev && sev !== "ALL" ? { borderColor: severityColor(sev) } : {}}
                      >
                        {sev === "ALL" ? "Tümü" : sev}
                        <span className="vuln-filter-count">
                          {sev === "ALL"
                            ? scan.summary.total
                            : scan.summary[sev.toLowerCase() as keyof typeof scan.summary]}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="vuln-search">
                    <MagnifyingGlassIcon size={13} />
                    <input
                      type="text"
                      placeholder="CVE, paket veya ürün ara..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="vuln-list">
                  {filteredVulns.length === 0 ? (
                    <div className="vuln-list-empty">Eşleşen zafiyet yok</div>
                  ) : (
                    filteredVulns.map((v) => (
                      <div key={v.cve_id} className="vuln-item" style={{ borderLeftColor: severityColor(v.severity) }}>
                        <div className="vuln-item-top">
                          <span
                            className="vuln-severity-badge"
                            style={{ background: severityBg(v.severity), color: severityColor(v.severity) }}
                          >
                            {v.severity}
                          </span>
                          <code className="vuln-cve-id">{v.cve_id}</code>
                          {v.cvss_score != null && (
                            <span className="vuln-cvss">CVSS {v.cvss_score.toFixed(1)}</span>
                          )}
                          {v.date_published && (
                            <span className="vuln-date">
                              {new Date(v.date_published).toLocaleDateString("tr-TR")}
                            </span>
                          )}
                        </div>
                        <div className="vuln-item-match">
                          <span className="vuln-pkg">
                            <PackageIcon size={12} />
                            {v.matched_package}
                            <code>{v.matched_version}</code>
                          </span>
                          <span className="vuln-arrow">→</span>
                          <span className="vuln-affected">
                            {v.affected_vendor}/{v.affected_product}
                            {v.version_lt && <code>&lt; {v.version_lt}</code>}
                            {v.version_lte && <code>≤ {v.version_lte}</code>}
                          </span>
                        </div>
                        {v.description && (
                          <p className="vuln-desc">{v.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {scan.summary.total === 0 && (
              <div className="vuln-clean">
                <ShieldCheckIcon size={48} weight="duotone" />
                <span>Bilinen zafiyet bulunamadı!</span>
                <span className="vuln-clean-sub">
                  {scan.scanned} paket tarandı, CVE veritabanıyla eşleşen zafiyet yok
                </span>
              </div>
            )}

            {scan.completedAt && (
              <div className="vuln-footer">
                Son tarama: {new Date(scan.completedAt).toLocaleString("tr-TR")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
