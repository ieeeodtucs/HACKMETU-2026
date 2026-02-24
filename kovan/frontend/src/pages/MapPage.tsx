import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "../store";
import {
  fetchAgentGeoData,
  type AgentGeoInfo,
  type GeoStats,
} from "../api";
import { WorldMap } from "../components/map/WorldMap";
import { MapSidebar } from "../components/map/MapSidebar";
import { MapLegend } from "../components/map/MapLegend";
import { NotificationBell } from "../components/NotificationBell";
import {
  UserIcon,
  CrownIcon,
  SignOutIcon,
  SpinnerGapIcon,
  ArrowLeftIcon,
  GearIcon,
  GlobeHemisphereWestIcon,
} from "@phosphor-icons/react";

export default function MapPage() {
  const { user, isAdmin, logout } = useAuthStore();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentGeoInfo[]>([]);
  const [stats, setStats] = useState<GeoStats>({
    totalAgents: 0,
    onlineAgents: 0,
    countries: [],
    cities: [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [highlightCountry, setHighlightCountry] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAgentGeoData();
        setAgents(data.agents);
        setStats(data.stats);
      } catch (err) {
        console.error("GeoIP fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleAgentClick = (agentId: string) => {
    setSelectedAgent(agentId === selectedAgent ? null : agentId);
  };

  const handleNavigateToAgent = (agentId: string) => {
    navigate(`/agent/${agentId}`);
  };

  return (
    <div className="shell">
      {/* Header — same structure as DashboardPage */}
      <header className="hdr">
        <div className="hdr-brand" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
          <img src="/assets/kovan-icon.svg" alt="Kovan" style={{ height: 32 }} />
          <span className="hdr-title">Kovan</span>
        </div>
        <div className="hdr-stats">
          <div className="hdr-kv">
            <GlobeHemisphereWestIcon size={14} weight="duotone" style={{ color: "var(--accent)" }} />
            <span className="hdr-k">Harita</span>
          </div>
          <div className="hdr-sep" />
          <div className="hdr-kv">
            <span className="hdr-k">Makineler</span>
            <span className="hdr-v">{stats.totalAgents}</span>
          </div>
          <div className="hdr-sep" />
          <div className="hdr-kv">
            <span className="hdr-k">Çevrimiçi</span>
            <span className="hdr-v green">{stats.onlineAgents}</span>
          </div>
          <div className="hdr-sep" />
          <div className="hdr-kv">
            <span className="hdr-k">Çevrimdışı</span>
            <span className="hdr-v red">{stats.totalAgents - stats.onlineAgents}</span>
          </div>
          <div className="hdr-sep" />
          <div className="hdr-kv">
            <span className="hdr-k">Ülkeler</span>
            <span className="hdr-v">{stats.countries.length}</span>
          </div>
        </div>
        <div className="hdr-user">
          <NotificationBell />
          <button className="hdr-settings-btn" onClick={() => navigate("/dashboard")} title="Dashboard'a Dön">
            <ArrowLeftIcon size={16} />
          </button>
          <button className="hdr-settings-btn" onClick={() => navigate("/settings")} title="Ayarlar">
            <GearIcon size={16} />
          </button>
          <span className="hdr-username">
            <UserIcon size={13} />
            {user?.name || user?.email}
          </span>
          {isAdmin && (
            <button className="hdr-admin-btn" onClick={() => navigate("/admin")}>
              <CrownIcon size={13} weight="fill" />
              Admin
            </button>
          )}
          <button
            className="hdr-logout"
            onClick={() => logout().then(() => navigate("/login"))}
          >
            <SignOutIcon size={14} />
            Çıkış
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="map-layout">
        {loading ? (
          <div className="map-loading">
            <SpinnerGapIcon size={40} className="si-run" />
            <p>Coğrafi veriler yükleniyor…</p>
          </div>
        ) : (
          <>
            <div className="map-container">
              <WorldMap
                agents={agents}
                selectedAgent={selectedAgent}
                highlightCountry={highlightCountry}
                onAgentClick={handleAgentClick}
                onNavigateToAgent={handleNavigateToAgent}
              />
              <MapLegend />
            </div>
            <MapSidebar
              agents={agents}
              stats={stats}
              selectedAgent={selectedAgent}
              onAgentClick={handleAgentClick}
              onNavigateToAgent={handleNavigateToAgent}
              onCountryHover={setHighlightCountry}
            />
          </>
        )}
      </div>
    </div>
  );
}
