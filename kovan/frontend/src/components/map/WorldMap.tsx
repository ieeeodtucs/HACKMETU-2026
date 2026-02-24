import { useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AgentGeoInfo } from "../../api";
import {
  LinuxLogoIcon,
  WindowsLogoIcon,
  DesktopTowerIcon,
  GlobeSimpleIcon,
  ClockIcon,
  UserIcon,
  WifiHighIcon,
  MapPinIcon,
} from "@phosphor-icons/react";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ─── Custom Marker Icons ─── */

function createAgentIcon(isOnline: boolean, isSelected: boolean): L.DivIcon {
  const color = isOnline ? "#16a34a" : "#4b5563";
  const glowColor = isOnline ? "rgba(22,163,74,0.35)" : "transparent";
  const size = isSelected ? 16 : 10;
  const outerSize = isSelected ? 36 : 26;
  const borderColor = isSelected ? "#FFCB08" : (isOnline ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)");
  const borderWidth = isSelected ? 2.5 : 2;

  return L.divIcon({
    className: "agent-map-marker",
    html: `
      <div class="marker-wrap" style="width:${outerSize}px;height:${outerSize}px">
        ${isOnline ? `<div class="marker-ring" style="width:${outerSize}px;height:${outerSize}px;border-color:${glowColor}"></div>` : ""}
        <div class="marker-core" style="width:${size}px;height:${size}px;background:${color};border:${borderWidth}px solid ${borderColor};box-shadow:0 0 ${isOnline ? 8 : 3}px ${glowColor}"></div>
      </div>
    `,
    iconSize: [outerSize, outerSize],
    iconAnchor: [outerSize / 2, outerSize / 2],
    popupAnchor: [0, -outerSize / 2],
  });
}

function createServerIcon(): L.DivIcon {
  return L.divIcon({
    className: "agent-map-marker",
    html: `
      <div class="marker-wrap" style="width:40px;height:40px">
        <div class="marker-ring server-ring" style="width:40px;height:40px"></div>
        <div class="server-core">
          <svg width="14" height="14" viewBox="0 0 256 256" fill="#231F20"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm0-160a72,72,0,1,0,72,72A72.08,72.08,0,0,0,128,56Zm0,128a56,56,0,1,1,56-56A56.06,56.06,0,0,1,128,184Zm0-96a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152Z"/></svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

/* ─── Cluster offset for overlapping agents ─── */
function getClusterOffset(index: number, total: number): [number, number] {
  if (total <= 1) return [0, 0];
  const angle = (2 * Math.PI * index) / total;
  const radius = 0.004 * Math.ceil(total / 6);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/* ─── Animated Connection Lines (canvas) ─── */
function ConnectionLines({ agents, serverPos }: { agents: AgentGeoInfo[]; serverPos: [number, number] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  // Use refs so the draw loop reads latest data without re-mounting the effect
  const agentsRef = useRef(agents);
  agentsRef.current = agents;
  const serverPosRef = useRef(serverPos);
  serverPosRef.current = serverPos;

  useEffect(() => {
    const pane = map.getPane("overlayPane");
    if (!pane) return;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "connection-canvas";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "450";
      pane.appendChild(canvas);
      canvasRef.current = canvas;
    }

    const startTime = performance.now();

    function draw() {
      if (!canvas) return;
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = size.x + "px";
      canvas.style.height = size.y + "px";

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      const elapsed = (performance.now() - startTime) / 1000;
      const from = map.latLngToContainerPoint(serverPosRef.current);
      const currentAgents = agentsRef.current.filter(
        (a) => a.isOnline && a.geo && a.geo.lat !== 0 && a.geo.lon !== 0
      );

      for (let i = 0; i < currentAgents.length; i++) {
        const agent = currentAgents[i];
        if (!agent.geo) continue;
        const to = map.latLngToContainerPoint([agent.geo.lat, agent.geo.lon]);

        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
        const arcHeight = Math.min(dist * 0.2, 60);
        const cpX = midX;
        const cpY = midY - arcHeight;

        // Faint bezier line
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
        ctx.strokeStyle = "rgba(255, 203, 8, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Animated particle
        const phase = (i * 0.37) % 1;
        const t = ((elapsed * 0.25) + phase) % 1;
        const px = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cpX + t * t * to.x;
        const py = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cpY + t * t * to.y;

        const grad = ctx.createRadialGradient(px, py, 0, px, py, 6);
        grad.addColorStop(0, "rgba(255, 203, 8, 0.6)");
        grad.addColorStop(1, "rgba(255, 203, 8, 0)");
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 203, 8, 0.85)";
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    const redraw = () => {
      cancelAnimationFrame(animRef.current);
      draw();
    };
    map.on("move", redraw);
    map.on("zoom", redraw);
    map.on("moveend", redraw);

    return () => {
      cancelAnimationFrame(animRef.current);
      map.off("move", redraw);
      map.off("zoom", redraw);
      map.off("moveend", redraw);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
        canvasRef.current = null;
      }
    };
  }, [map]); // only depend on map — agents/serverPos read from refs

  return null;
}

/* ─── Pan to selected agent + open its popup ─── */
function PanToAgent({
  selectedAgent,
  markerRefs,
}: {
  selectedAgent: string | null;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedAgent === prevRef.current) return;
    prevRef.current = selectedAgent;
    if (!selectedAgent) return;

    const marker = markerRefs.current.get(selectedAgent);
    if (!marker) return;

    const pos = marker.getLatLng();
    // Pan without changing zoom
    map.panTo(pos, { animate: true, duration: 0.6 });

    // Open this specific marker's popup after pan completes
    setTimeout(() => {
      marker.openPopup();
    }, 650);
  }, [selectedAgent, map, markerRefs]);

  return null;
}

/* ─── Helpers ─── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  return `${Math.floor(hr / 24)}g önce`;
}

/* ─── Main Component ─── */
interface WorldMapProps {
  agents: AgentGeoInfo[];
  selectedAgent: string | null;
  highlightCountry: string | null;
  onAgentClick: (agentId: string) => void;
  onNavigateToAgent: (agentId: string) => void;
}

export function WorldMap({
  agents,
  selectedAgent,
  highlightCountry,
  onAgentClick,
  onNavigateToAgent,
}: WorldMapProps) {
  // Store refs to every Leaflet Marker by agent ID
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  const setMarkerRef = useCallback((agentId: string, ref: L.Marker | null) => {
    if (ref) {
      markerRefs.current.set(agentId, ref);
    } else {
      markerRefs.current.delete(agentId);
    }
  }, []);

  // Server location — centroid of all agents
  const serverPos: [number, number] = useMemo(() => {
    const withGeo = agents.filter((a) => a.geo && a.geo.lat !== 0);
    if (withGeo.length === 0) return [39.925, 32.866];
    const latSum = withGeo.reduce((s, a) => s + a.geo!.lat, 0);
    const lonSum = withGeo.reduce((s, a) => s + a.geo!.lon, 0);
    return [latSum / withGeo.length, lonSum / withGeo.length];
  }, [agents]);

  // Group agents by close positions for clustering
  const positionGroups = useMemo(() => {
    const groups = new Map<string, AgentGeoInfo[]>();
    for (const a of agents) {
      if (!a.geo || (a.geo.lat === 0 && a.geo.lon === 0)) continue;
      const key = `${a.geo.lat.toFixed(2)},${a.geo.lon.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    }
    return groups;
  }, [agents]);

  const agentsWithGeo = useMemo(
    () => agents.filter((a) => a.geo && (a.geo.lat !== 0 || a.geo.lon !== 0)),
    [agents]
  );

  // Initial center — computed once
  const initialCenter: [number, number] = useMemo(() => {
    if (agentsWithGeo.length === 0) return [30, 20];
    const lats = agentsWithGeo.map((a) => a.geo!.lat);
    const lons = agentsWithGeo.map((a) => a.geo!.lon);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lons) + Math.max(...lons)) / 2,
    ];
  }, []); // empty deps = only on mount

  const serverIcon = useMemo(() => createServerIcon(), []);

  return (
    <MapContainer
      center={initialCenter}
      zoom={3}
      minZoom={2}
      maxZoom={18}
      className="world-map"
      zoomControl={false}
      attributionControl={false}
      worldCopyJump={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />

      <ConnectionLines agents={agents} serverPos={serverPos} />

      {/* Pan to selected + open its popup */}
      <PanToAgent selectedAgent={selectedAgent} markerRefs={markerRefs} />

      {/* Server beacon */}
      <Marker position={serverPos} icon={serverIcon}>
        <Popup className="agent-popup" maxWidth={200}>
          <div className="popup-content">
            <div className="popup-header">
              <WifiHighIcon size={14} weight="bold" style={{ color: "var(--accent)" }} />
              <strong>Kovan Server</strong>
            </div>
            <div className="popup-details">
              <div className="popup-row">
                <MapPinIcon size={13} />
                <span>{serverPos[0].toFixed(2)}°, {serverPos[1].toFixed(2)}°</span>
              </div>
              <div className="popup-row">
                <DesktopTowerIcon size={13} />
                <span>{agents.filter((a) => a.isOnline).length} aktif bağlantı</span>
              </div>
            </div>
          </div>
        </Popup>
      </Marker>

      {/* Agent markers — each gets a ref stored by agent ID */}
      {Array.from(positionGroups.entries()).flatMap(([_key, group]) =>
        group.map((agent, idx) => {
          const [oLat, oLon] = getClusterOffset(idx, group.length);
          const lat = agent.geo!.lat + oLat;
          const lon = agent.geo!.lon + oLon;
          const isSelected = agent.id === selectedAgent;
          const isHighlighted = highlightCountry != null && agent.geo?.country === highlightCountry;

          return (
            <Marker
              key={agent.id}
              position={[lat, lon]}
              icon={createAgentIcon(agent.isOnline, isSelected || !!isHighlighted)}
              eventHandlers={{ click: () => onAgentClick(agent.id) }}
              ref={(ref) => setMarkerRef(agent.id, ref)}
            >
              <Popup className="agent-popup" maxWidth={280}>
                <div className="popup-content">
                  <div className="popup-header">
                    <span className={`popup-status ${agent.isOnline ? "online" : "offline"}`} />
                    <strong>{agent.alias || agent.hostname}</strong>
                    {agent.alias && <span className="popup-hostname">{agent.hostname}</span>}
                  </div>
                  <div className="popup-details">
                    <div className="popup-row">
                      <GlobeSimpleIcon size={13} />
                      <span>{agent.geo!.city}, {agent.geo!.region} — {agent.geo!.country}</span>
                    </div>
                    <div className="popup-row">
                      <DesktopTowerIcon size={13} />
                      <span>{agent.ip}</span>
                    </div>
                    <div className="popup-row">
                      <UserIcon size={13} />
                      <span>{agent.username}</span>
                    </div>
                    <div className="popup-row">
                      {agent.os.toLowerCase().includes("win")
                        ? <WindowsLogoIcon size={13} />
                        : <LinuxLogoIcon size={13} />}
                      <span>{agent.os}</span>
                    </div>
                    <div className="popup-row">
                      <ClockIcon size={13} />
                      <span>{timeAgo(agent.lastSeen)}</span>
                    </div>
                    {agent.geo!.isp !== "Unknown" && (
                      <div className="popup-row popup-isp">
                        <span>{agent.geo!.isp}</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="popup-action"
                    onClick={(e) => { e.stopPropagation(); onNavigateToAgent(agent.id); }}
                  >
                    Kontrol Paneli →
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })
      )}

      {/* Country highlight rings */}
      {highlightCountry && agentsWithGeo
        .filter((a) => a.geo?.country === highlightCountry)
        .map((a) => (
          <CircleMarker
            key={`hl-${a.id}`}
            center={[a.geo!.lat, a.geo!.lon]}
            radius={22}
            pathOptions={{
              color: "#FFCB08",
              fillColor: "rgba(255,203,8,0.1)",
              fillOpacity: 0.25,
              weight: 1.5,
              dashArray: "5 5",
            }}
          />
        ))}
    </MapContainer>
  );
}
