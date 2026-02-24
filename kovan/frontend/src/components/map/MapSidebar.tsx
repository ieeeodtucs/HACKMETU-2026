import { useState } from "react";
import type { AgentGeoInfo, GeoStats } from "../../api";
import {
  GlobeSimpleIcon,
  MapPinIcon,
  DesktopTowerIcon,
  CaretDownIcon,
  CaretUpIcon,
  ArrowSquareOutIcon,
  FlagBannerIcon,
  WifiHighIcon,
} from "@phosphor-icons/react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa`;
  return `${Math.floor(hr / 24)}g`;
}

/** Styled 2-letter country badge */
function CountryBadge({ code, size = "md" }: { code: string; size?: "sm" | "md" }) {
  const display = (!code || code === "XX" || code === "LAN") ? "??" : code.toUpperCase();
  return <span className={`country-badge ${size === "sm" ? "country-badge-sm" : ""}`}>{display}</span>;
}

interface MapSidebarProps {
  agents: AgentGeoInfo[];
  stats: GeoStats;
  selectedAgent: string | null;
  onAgentClick: (agentId: string) => void;
  onNavigateToAgent: (agentId: string) => void;
  onCountryHover: (country: string | null) => void;
}

export function MapSidebar({
  agents,
  stats,
  selectedAgent,
  onAgentClick,
  onNavigateToAgent,
  onCountryHover,
}: MapSidebarProps) {
  const [tab, setTab] = useState<"countries" | "agents">("countries");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const agentsWithGeo = agents.filter((a) => a.geo && a.geo.lat !== 0);

  return (
    <div className="map-sidebar">
      {/* Stats overview */}
      <div className="map-sidebar-stats">
        <div className="mss-item">
          <DesktopTowerIcon size={16} className="mss-icon" />
          <div className="mss-val">{stats.totalAgents}</div>
          <div className="mss-label">Toplam</div>
        </div>
        <div className="mss-item mss-online">
          <WifiHighIcon size={16} className="mss-icon" />
          <div className="mss-val">{stats.onlineAgents}</div>
          <div className="mss-label">Çevrimiçi</div>
        </div>
        <div className="mss-item">
          <GlobeSimpleIcon size={16} className="mss-icon" />
          <div className="mss-val">{stats.countries.length}</div>
          <div className="mss-label">Ülke</div>
        </div>
        <div className="mss-item">
          <MapPinIcon size={16} className="mss-icon" />
          <div className="mss-val">{stats.cities.length}</div>
          <div className="mss-label">Şehir</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="map-sidebar-tabs">
        <button
          className={`mst-tab ${tab === "countries" ? "active" : ""}`}
          onClick={() => setTab("countries")}
        >
          <FlagBannerIcon size={14} weight={tab === "countries" ? "fill" : "regular"} />
          Ülkeler
        </button>
        <button
          className={`mst-tab ${tab === "agents" ? "active" : ""}`}
          onClick={() => setTab("agents")}
        >
          <DesktopTowerIcon size={14} weight={tab === "agents" ? "fill" : "regular"} />
          Agentlar
        </button>
      </div>

      {/* Scrollable content */}
      <div className="map-sidebar-content">
        {tab === "countries" ? (
          <div className="country-list">
            {stats.countries.map((c) => {
              const isExpanded = expandedCountry === c.name;
              const countryAgents = agentsWithGeo.filter((a) => a.geo?.country === c.name);
              const cc = countryAgents[0]?.geo?.countryCode || "XX";

              return (
                <div key={c.name} className="country-item">
                  <div
                    className={`country-header ${isExpanded ? "expanded" : ""}`}
                    onClick={() => setExpandedCountry(isExpanded ? null : c.name)}
                    onMouseEnter={() => onCountryHover(c.name)}
                    onMouseLeave={() => onCountryHover(null)}
                  >
                    <CountryBadge code={cc} />
                    <span className="country-name">{c.name}</span>
                    <span className="country-counts">
                      <span className="cc-online">{c.online}</span>
                      <span className="cc-sep">/</span>
                      <span className="cc-total">{c.count}</span>
                    </span>
                    {isExpanded
                      ? <CaretUpIcon size={12} weight="bold" />
                      : <CaretDownIcon size={12} weight="bold" />}
                  </div>
                  {isExpanded && (
                    <div className="country-agents">
                      {countryAgents.map((a) => (
                        <div
                          key={a.id}
                          className={`ca-item ${a.id === selectedAgent ? "selected" : ""}`}
                          onClick={() => onAgentClick(a.id)}
                        >
                          <span className={`ca-dot ${a.isOnline ? "online" : "offline"}`} />
                          <div className="ca-info">
                            <span className="ca-name">{a.alias || a.hostname}</span>
                            <span className="ca-detail">{a.geo?.city} · {a.ip}</span>
                          </div>
                          <button
                            className="ca-goto"
                            onClick={(e) => { e.stopPropagation(); onNavigateToAgent(a.id); }}
                            title="Kontrol Paneli"
                          >
                            <ArrowSquareOutIcon size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {stats.countries.length === 0 && (
              <div className="map-empty">
                <GlobeSimpleIcon size={36} weight="duotone" />
                <p>Henüz coğrafi veri yok</p>
                <span>Agent'lar bağlandığında burada görünecek</span>
              </div>
            )}
          </div>
        ) : (
          <div className="agent-geo-list">
            {agentsWithGeo.map((a) => (
              <div
                key={a.id}
                className={`agl-item ${a.id === selectedAgent ? "selected" : ""}`}
                onClick={() => onAgentClick(a.id)}
              >
                <span className={`agl-dot ${a.isOnline ? "online" : "offline"}`} />
                <div className="agl-info">
                  <div className="agl-top">
                    <span className="agl-name">{a.alias || a.hostname}</span>
                    <span className="agl-time">{timeAgo(a.lastSeen)}</span>
                  </div>
                  <div className="agl-bottom">
                    <CountryBadge code={a.geo?.countryCode || "XX"} size="sm" />
                    <span className="agl-location">{a.geo?.city}, {a.geo?.countryCode}</span>
                    <span className="agl-ip">{a.ip}</span>
                  </div>
                </div>
                <button
                  className="agl-goto"
                  onClick={(e) => { e.stopPropagation(); onNavigateToAgent(a.id); }}
                  title="Kontrol Paneli"
                >
                  <ArrowSquareOutIcon size={14} />
                </button>
              </div>
            ))}
            {agentsWithGeo.length === 0 && (
              <div className="map-empty">
                <MapPinIcon size={36} weight="duotone" />
                <p>Konum verisi olan agent yok</p>
                <span>Agent public IP ile bağlandığında konum belirlenecek</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
