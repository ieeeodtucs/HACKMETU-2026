/** Architecture diagram — Pardus/Landing page style */
export default function ArchitectureDiagram() {
  const font = "'IBM Plex Sans', system-ui, sans-serif";
  const mono = "'IBM Plex Mono', monospace";
  const accent = "#FFCB08";
  const dark = "#231F20";
  const muted = "rgba(35,31,32,0.5)";
  const green = "#16a34a";
  const blue = "#2563eb";
  const red = "#dc2626";
  const purple = "#7c3aed";

  return (
    <div className="excalidraw-diagram">
      <svg viewBox="0 0 920 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="archGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.5" fill="rgba(0,0,0,0.04)" />
          </pattern>
          <marker id="aY" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={accent} />
          </marker>
          <marker id="aG" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={green} />
          </marker>
          <marker id="aB" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={blue} />
          </marker>
          <marker id="aR" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={red} />
          </marker>
        </defs>
        <rect width="920" height="400" fill="url(#archGrid)" rx="16" />

        {/* AGENTS */}
        {[
          { y: 35, label: "Pardus / Windows" },
          { y: 130, label: "Pardus Lab-1" },
          { y: 225, label: "Sunucu Grubu" },
        ].map((a, i) => (
          <g key={i}>
            <rect x="20" y={a.y} width="155" height="65" rx="12" fill="#FFF5CD" stroke={accent} strokeWidth="1.5" />
            <text x="97" y={a.y + 26} textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="13" fill={dark}>Agent (Go)</text>
            <text x="97" y={a.y + 44} textAnchor="middle" fontFamily={font} fontSize="11" fill={muted}>{a.label}</text>
          </g>
        ))}

        {/* Arrows Agent to Server */}
        <path d="M175 67 Q215 67 260 150" stroke={accent} strokeWidth="1.5" strokeDasharray="6 3" fill="none" markerEnd="url(#aY)" />
        <path d="M175 162 L260 162" stroke={accent} strokeWidth="1.5" strokeDasharray="6 3" fill="none" markerEnd="url(#aY)" />
        <path d="M175 257 Q215 257 260 180" stroke={accent} strokeWidth="1.5" strokeDasharray="6 3" fill="none" markerEnd="url(#aY)" />
        <text x="208" y="106" fontFamily={mono} fontSize="9" fill={muted} transform="rotate(-24 208 106)">WebSocket</text>

        {/* SERVER */}
        <rect x="260" y="115" width="195" height="100" rx="14" fill={dark} stroke={accent} strokeWidth="2.5" />
        <text x="357" y="148" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="15" fill={accent}>Kovan Server</text>
        <text x="357" y="168" textAnchor="middle" fontFamily={font} fontSize="11" fill="rgba(255,255,255,0.6)">Bun + Hono</text>
        <text x="357" y="186" textAnchor="middle" fontFamily={font} fontSize="11" fill="rgba(255,255,255,0.6)">REST API + WebSocket</text>
        <text x="357" y="204" textAnchor="middle" fontFamily={mono} fontSize="10" fill="rgba(255,255,255,0.35)">:4444</text>

        {/* Server to Dashboard */}
        <path d="M455 148 L540 80" stroke={green} strokeWidth="1.5" fill="none" markerEnd="url(#aG)" />
        <text x="486" y="102" fontFamily={mono} fontSize="9" fill={green} transform="rotate(-28 486 102)">REST/WS</text>

        {/* DASHBOARD */}
        <rect x="540" y="35" width="175" height="72" rx="12" fill="white" stroke={green} strokeWidth="1.5" />
        <text x="627" y="63" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="13" fill={dark}>Dashboard</text>
        <text x="627" y="81" textAnchor="middle" fontFamily={font} fontSize="11" fill={muted}>React + Vite</text>
        <text x="627" y="97" textAnchor="middle" fontFamily={mono} fontSize="10" fill="rgba(0,0,0,0.25)">:5173</text>

        {/* Server to PostgreSQL */}
        <path d="M455 175 L540 175" stroke={blue} strokeWidth="1.5" fill="none" markerEnd="url(#aB)" />

        {/* POSTGRESQL */}
        <rect x="540" y="135" width="175" height="72" rx="12" fill="rgba(37,99,235,0.04)" stroke={blue} strokeWidth="1.5" />
        <text x="627" y="163" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="13" fill={blue}>PostgreSQL</text>
        <text x="627" y="181" textAnchor="middle" fontFamily={font} fontSize="11" fill={muted}>CVE + Auth + Scheduler</text>
        <text x="627" y="197" textAnchor="middle" fontFamily={mono} fontSize="10" fill="rgba(0,0,0,0.25)">47K+ CVE</text>

        {/* Server to ATTDAP */}
        <path d="M455 200 Q505 265 540 272" stroke={red} strokeWidth="1.5" fill="none" markerEnd="url(#aR)" />
        <text x="490" y="255" fontFamily={mono} fontSize="9" fill={red}>HTTP</text>

        {/* ATTDAP */}
        <rect x="540" y="240" width="175" height="72" rx="12" fill="rgba(220,38,38,0.04)" stroke={red} strokeWidth="1.5" />
        <text x="627" y="268" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="13" fill={red}>ATTDAP</text>
        <text x="627" y="286" textAnchor="middle" fontFamily={font} fontSize="11" fill={muted}>Python + FastAPI</text>
        <text x="627" y="302" textAnchor="middle" fontFamily={mono} fontSize="10" fill="rgba(0,0,0,0.25)">IF + GMM + AE</text>

        {/* AUTH */}
        <rect x="740" y="145" width="155" height="52" rx="10" fill="rgba(124,58,237,0.04)" stroke={purple} strokeWidth="1.5" />
        <text x="817" y="168" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="12" fill={purple}>Better Auth</text>
        <text x="817" y="185" textAnchor="middle" fontFamily={font} fontSize="10" fill={muted}>Rol Tabanlı Erişim</text>
        <path d="M715 175 L740 175" stroke={purple} strokeWidth="1" strokeDasharray="4 3" fill="none" />

        {/* LEGEND */}
        <rect x="20" y="342" width="875" height="44" rx="10" fill="rgba(0,0,0,0.02)" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
        {[
          { x: 44, color: accent, label: "Agent - Server" },
          { x: 195, color: green, label: "Dashboard" },
          { x: 310, color: blue, label: "Veritabanı" },
          { x: 430, color: red, label: "ML Pipeline" },
          { x: 555, color: purple, label: "Kimlik Yönetimi" },
        ].map((l) => (
          <g key={l.label}>
            <circle cx={l.x} cy="364" r="4" fill={l.color} />
            <text x={l.x + 10} y="368" fontFamily={font} fontSize="11" fill={muted}>{l.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
