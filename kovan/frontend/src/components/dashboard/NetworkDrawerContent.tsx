import { useState } from "react";
import type { NetworkScanResult } from "../../api";
import { riskColor, riskBg, formatBytes } from "./helpers";
import { ScoreGauge } from "./ScoreGauge";
import {
  SpinnerGapIcon,
  WarningCircleIcon,
  ShieldCheckIcon,
  WifiHighIcon as WaveIcon,
  PlugIcon,
  ArrowsDownUpIcon,
} from "@phosphor-icons/react";

export function NetworkDrawerContent({
  scan,
  scanning,
}: {
  scan: NetworkScanResult | null;
  scanning: boolean;
  onTrigger: () => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredConns = scan?.connections.filter((c) => {
    if (filter === "ALL") return true;
    return c.risk_level === filter.toLowerCase();
  }) || [];

  return (
    <div className="net-panel expanded" style={{ border: "none", borderRadius: 0, margin: 0, background: "transparent" }}>
      <div className="net-body" style={{ maxHeight: "none" }}>
        {!scan && !scanning && (
          <div className="net-empty">
            <WaveIcon size={40} weight="duotone" />
            <span>Henüz ağ analizi yapılmadı</span>
            <span className="net-empty-sub">
              "Analiz Et" butonuna basarak tüm aktif ağ bağlantılarını ATTDAP AI modeli ile tarayın
            </span>
          </div>
        )}

        {scanning && (
          <div className="net-scanning">
            <SpinnerGapIcon size={32} className="si-run" />
            <span>Ağ bağlantıları toplanıyor ve AI modeli ile analiz ediliyor...</span>
            <span className="net-scanning-sub">Isolation Forest + Autoencoder + GMM ensemble</span>
          </div>
        )}

        {scan && scan.status === "error" && (
          <div className="net-error">
            <WarningCircleIcon size={32} weight="fill" />
            <span>Analiz hatası: {scan.error}</span>
          </div>
        )}

        {scan && scan.status === "completed" && (
          <>
            <div className="net-summary">
              <div className="net-summary-main">
                <ScoreGauge score={scan.summary.mean_score} size={56} />
                <div className="net-summary-text">
                  <span className="net-summary-title">Ortalama Risk Skoru</span>
                  <span className="net-summary-subtitle">{scan.summary.total} bağlantı analiz edildi</span>
                </div>
              </div>
              <div className="net-summary-risks">
                <div className="net-risk-item net-risk-critical">
                  <span className="net-risk-val">{scan.summary.critical}</span>
                  <span className="net-risk-label">Kritik</span>
                </div>
                <div className="net-risk-item net-risk-high">
                  <span className="net-risk-val">{scan.summary.high}</span>
                  <span className="net-risk-label">Yüksek</span>
                </div>
                <div className="net-risk-item net-risk-medium">
                  <span className="net-risk-val">{scan.summary.medium}</span>
                  <span className="net-risk-label">Orta</span>
                </div>
                <div className="net-risk-item net-risk-low">
                  <span className="net-risk-val">{scan.summary.low}</span>
                  <span className="net-risk-label">Düşük</span>
                </div>
              </div>
            </div>

            {scan.connections.length > 0 && (
              <>
                <div className="net-filters">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                    <button
                      key={sev}
                      className={`net-filter-tab ${filter === sev ? "active" : ""}`}
                      onClick={() => setFilter(sev)}
                    >
                      {sev === "ALL" ? "Tümü" : sev}
                      <span className="net-filter-count">
                        {sev === "ALL"
                          ? scan.summary.total
                          : scan.summary[sev.toLowerCase() as keyof typeof scan.summary] || 0}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="net-list">
                  {filteredConns.length === 0 ? (
                    <div className="net-list-empty">Bu filtrede bağlantı yok</div>
                  ) : (
                    filteredConns.map((conn, i) => (
                      <div
                        key={i}
                        className="net-item"
                        style={{ borderLeftColor: riskColor(conn.risk_level) }}
                      >
                        <div className="net-item-top">
                          <ScoreGauge score={conn.hybrid_score} size={36} />
                          <div className="net-item-info">
                            <div className="net-item-addr">
                              <code>{conn.source_ip}:{conn.source_port}</code>
                              <span className="net-arrow">→</span>
                              <code>{conn.dest_ip}:{conn.dest_port}</code>
                            </div>
                            <div className="net-item-meta">
                              <span
                                className="net-risk-badge"
                                style={{ background: riskBg(conn.risk_level), color: riskColor(conn.risk_level) }}
                              >
                                {conn.risk_level.toUpperCase()}
                              </span>
                              {conn.process && (
                                <span className="net-process">
                                  <PlugIcon size={11} />
                                  {conn.process}
                                  {conn.pid && <code>({conn.pid})</code>}
                                </span>
                              )}
                              <span className="net-state">{conn.state}</span>
                            </div>
                          </div>
                        </div>
                        <div className="net-item-stats">
                          <span className="net-stat">
                            <ArrowsDownUpIcon size={11} />
                            ↑ {formatBytes(conn.bytes_sent)} / ↓ {formatBytes(conn.bytes_received)}
                          </span>
                          <span className="net-stat">
                            Paket: {conn.segs_out}↑ / {conn.segs_in}↓
                          </span>
                          {conn.rtt > 0 && (
                            <span className="net-stat">RTT: {conn.rtt.toFixed(1)}ms</span>
                          )}
                          <span className="net-stat net-scores">
                            IF:{conn.if_score.toFixed(2)} AE:{conn.ae_score.toFixed(2)} GMM:{conn.gmm_score.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {scan.connections.length === 0 && (
              <div className="net-clean">
                <ShieldCheckIcon size={48} weight="duotone" />
                <span>Aktif bağlantı bulunamadı</span>
              </div>
            )}

            {scan.completedAt && (
              <div className="net-footer">
                Son analiz: {new Date(scan.completedAt).toLocaleString("tr-TR")}
                {scan.summary.max_score > 0 && (
                  <span className="net-footer-max">
                    Maks. skor: <b>{scan.summary.max_score}</b>
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
