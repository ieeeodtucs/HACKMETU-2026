/** ATTDAP pipeline diagram — Pardus/Landing page style */
export default function AnomalyDiagram() {
  const font = "'IBM Plex Sans', system-ui, sans-serif";
  const mono = "'IBM Plex Mono', monospace";
  const accent = "#FFCB08";
  const green = "#16a34a";
  const blue = "#2563eb";
  const red = "#dc2626";
  const purple = "#7c3aed";
  const light = "rgba(255,255,255,0.5)";
  const dim = "rgba(255,255,255,0.3)";

  return (
    <div className="excalidraw-diagram">
      <svg viewBox="0 0 900 280" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="gridD" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.4" fill="rgba(255,255,255,0.04)" />
          </pattern>
          <marker id="mY" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={accent} />
          </marker>
        </defs>
        <rect width="900" height="280" fill="url(#gridD)" rx="12" />

        {/* Input */}
        <rect x="20" y="95" width="130" height="90" rx="12" fill="rgba(255,203,8,0.06)" stroke="rgba(255,203,8,0.25)" strokeWidth="1.5" />
        <text x="85" y="125" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="13" fill={accent}>Ağ Trafiği</text>
        <text x="85" y="145" textAnchor="middle" fontFamily={font} fontSize="10" fill={light}>26 Özellik</text>
        <text x="85" y="162" textAnchor="middle" fontFamily={mono} fontSize="9" fill={dim}>src_ip, dst_ip, bytes...</text>

        <path d="M150 140 L195 140" stroke={accent} strokeWidth="1.5" fill="none" markerEnd="url(#mY)" />

        {/* Feature Engineering */}
        <rect x="200" y="95" width="130" height="90" rx="12" fill="rgba(37,99,235,0.06)" stroke="rgba(37,99,235,0.25)" strokeWidth="1.5" />
        <text x="265" y="125" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="12" fill={blue}>Feature Eng.</text>
        <text x="265" y="145" textAnchor="middle" fontFamily={font} fontSize="10" fill={light}>Normalizasyon</text>
        <text x="265" y="162" textAnchor="middle" fontFamily={font} fontSize="10" fill={light}>Scaling + Encoding</text>

        {/* Arrows to models */}
        <path d="M330 120 L395 60" stroke={accent} strokeWidth="1" strokeDasharray="5 3" fill="none" markerEnd="url(#mY)" />
        <path d="M330 140 L395 140" stroke={accent} strokeWidth="1" strokeDasharray="5 3" fill="none" markerEnd="url(#mY)" />
        <path d="M330 160 L395 220" stroke={accent} strokeWidth="1" strokeDasharray="5 3" fill="none" markerEnd="url(#mY)" />

        {/* Isolation Forest */}
        <rect x="400" y="20" width="150" height="65" rx="10" fill="rgba(22,163,74,0.06)" stroke="rgba(22,163,74,0.25)" strokeWidth="1.5" />
        <text x="475" y="45" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="12" fill={green}>Isolation Forest</text>
        <text x="475" y="62" textAnchor="middle" fontFamily={mono} fontSize="10" fill={dim}>w = 0.10</text>

        {/* GMM */}
        <rect x="400" y="105" width="150" height="65" rx="10" fill="rgba(124,58,237,0.06)" stroke="rgba(124,58,237,0.25)" strokeWidth="1.5" />
        <text x="475" y="130" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="12" fill={purple}>GMM</text>
        <text x="475" y="150" textAnchor="middle" fontFamily={mono} fontSize="10" fill={dim}>w = 0.90</text>

        {/* Autoencoder */}
        <rect x="400" y="195" width="150" height="65" rx="10" fill="rgba(220,38,38,0.06)" stroke="rgba(220,38,38,0.25)" strokeWidth="1.5" />
        <text x="475" y="220" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="12" fill={red}>Autoencoder</text>
        <text x="475" y="237" textAnchor="middle" fontFamily={mono} fontSize="10" fill={dim}>PyTorch DAE</text>

        {/* Arrows to Hybrid */}
        <path d="M550 52 L615 115" stroke={accent} strokeWidth="1" fill="none" markerEnd="url(#mY)" />
        <path d="M550 138 L615 138" stroke={accent} strokeWidth="1" fill="none" markerEnd="url(#mY)" />
        <path d="M550 228 L615 158" stroke={accent} strokeWidth="1" fill="none" markerEnd="url(#mY)" />

        {/* Hybrid Scorer */}
        <rect x="620" y="95" width="135" height="90" rx="12" fill="rgba(255,203,8,0.06)" stroke={accent} strokeWidth="2" />
        <text x="687" y="125" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="13" fill={accent}>Hybrid Scorer</text>
        <text x="687" y="148" textAnchor="middle" fontFamily={font} fontSize="10" fill={light}>Weighted Ensemble</text>
        <text x="687" y="168" textAnchor="middle" fontFamily={mono} fontSize="10" fill={dim}>0-100 Risk Score</text>

        <path d="M755 140 L795 140" stroke={accent} strokeWidth="1.5" fill="none" markerEnd="url(#mY)" />

        {/* Risk Output */}
        <rect x="800" y="80" width="85" height="120" rx="10" fill="rgba(220,38,38,0.04)" stroke="rgba(220,38,38,0.2)" strokeWidth="1.5" />
        <text x="842" y="106" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="11" fill={light}>Risk</text>
        <rect x="815" y="116" width="55" height="10" rx="3" fill="rgba(22,163,74,0.2)" stroke="rgba(22,163,74,0.35)" strokeWidth="0.5" />
        <text x="842" y="124" textAnchor="middle" fontFamily={mono} fontSize="8" fill={green}>LOW</text>
        <rect x="815" y="131" width="55" height="10" rx="3" fill="rgba(217,119,6,0.2)" stroke="rgba(217,119,6,0.35)" strokeWidth="0.5" />
        <text x="842" y="139" textAnchor="middle" fontFamily={mono} fontSize="8" fill="#d97706">MED</text>
        <rect x="815" y="146" width="55" height="10" rx="3" fill="rgba(220,38,38,0.2)" stroke="rgba(220,38,38,0.35)" strokeWidth="0.5" />
        <text x="842" y="154" textAnchor="middle" fontFamily={mono} fontSize="8" fill={red}>HIGH</text>
        <rect x="815" y="161" width="55" height="10" rx="3" fill="rgba(220,38,38,0.35)" stroke="rgba(220,38,38,0.5)" strokeWidth="0.5" />
        <text x="842" y="169" textAnchor="middle" fontFamily={mono} fontSize="8" fill={red}>CRIT</text>
        <text x="842" y="192" textAnchor="middle" fontFamily={mono} fontSize="9" fill={dim}>score &gt;= 75</text>
      </svg>
    </div>
  );
}
