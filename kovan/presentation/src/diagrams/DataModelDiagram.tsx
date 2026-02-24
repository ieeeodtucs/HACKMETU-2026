/** Data model diagram — Pardus/Landing page style */
export default function DataModelDiagram() {
  const font = "'IBM Plex Sans', system-ui, sans-serif";
  const mono = "'IBM Plex Mono', monospace";
  const accent = "#FFCB08";
  const dark = "#231F20";
  const muted = "rgba(35,31,32,0.45)";
  const blue = "#2563eb";
  const green = "#16a34a";
  const red = "#dc2626";
  const purple = "#7c3aed";
  const amber = "#d97706";

  return (
    <div className="excalidraw-diagram">
      <svg viewBox="0 0 900 460" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="gridM" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="0.5" fill="rgba(0,0,0,0.04)" />
          </pattern>
          <marker id="mArr" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(0,0,0,0.25)" />
          </marker>
        </defs>
        <rect width="900" height="460" fill="url(#gridM)" rx="16" />

        {/* Agent */}
        <rect x="30" y="20" width="240" height="220" rx="12" fill="white" stroke={accent} strokeWidth="1.5" />
        <rect x="30" y="20" width="240" height="36" rx="12" fill={accent} />
        <rect x="30" y="44" width="240" height="12" fill={accent} />
        <text x="150" y="44" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="14" fill={dark}>Agent</text>
        {[
          ["id", "string", true],
          ["hostname", "string", false],
          ["alias?", "string", false],
          ["group?", "string", false],
          ["os", "string", false],
          ["ip", "string", false],
          ["username", "string", false],
          ["fingerprint", "string", false],
          ["isOnline", "boolean", false],
        ].map(([name, type, pk], i) => (
          <g key={String(name)}>
            <text x="45" y={80 + i * 18} fontFamily={font} fontSize="11" fill={pk ? accent : dark} fontWeight={pk ? "700" : "400"}>{String(name)}</text>
            <text x="200" y={80 + i * 18} fontFamily={mono} fontSize="10" fill={blue}>{String(type)}</text>
          </g>
        ))}

        {/* Command */}
        <rect x="330" y="20" width="240" height="180" rx="12" fill="white" stroke={green} strokeWidth="1.5" />
        <rect x="330" y="20" width="240" height="36" rx="12" fill={green} />
        <rect x="330" y="44" width="240" height="12" fill={green} />
        <text x="450" y="44" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="14" fill="white">Command</text>
        {[
          ["id", "string", "PK"],
          ["agentId", "string", "FK"],
          ["command", "string", ""],
          ["status", "enum", ""],
          ["output", "string", ""],
          ["sentAt", "datetime", ""],
          ["doneAt?", "datetime", ""],
        ].map(([name, type, pk], i) => (
          <g key={String(name)}>
            <text x="345" y={80 + i * 18} fontFamily={font} fontSize="11" fill={pk === "PK" ? green : pk === "FK" ? amber : dark} fontWeight={pk ? "700" : "400"}>{String(name)}</text>
            <text x="500" y={80 + i * 18} fontFamily={mono} fontSize="10" fill={blue}>{String(type)}</text>
          </g>
        ))}

        {/* CVE */}
        <rect x="630" y="20" width="240" height="180" rx="12" fill="white" stroke={red} strokeWidth="1.5" />
        <rect x="630" y="20" width="240" height="36" rx="12" fill={red} />
        <rect x="630" y="44" width="240" height="12" fill={red} />
        <text x="750" y="44" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="14" fill="white">CVE</text>
        {[
          ["cve_id", "string", "PK"],
          ["description", "text", ""],
          ["severity", "enum", ""],
          ["cvss_score", "float", ""],
          ["published", "date", ""],
          ["affected[]", "relation", ""],
        ].map(([name, type, pk], i) => (
          <g key={String(name)}>
            <text x="645" y={80 + i * 18} fontFamily={font} fontSize="11" fill={pk === "PK" ? red : dark} fontWeight={pk ? "700" : "400"}>{String(name)}</text>
            <text x="810" y={80 + i * 18} fontFamily={mono} fontSize="10" fill={blue}>{String(type)}</text>
          </g>
        ))}

        {/* User */}
        <rect x="30" y="280" width="240" height="160" rx="12" fill="white" stroke={purple} strokeWidth="1.5" />
        <rect x="30" y="280" width="240" height="36" rx="12" fill={purple} />
        <rect x="30" y="304" width="240" height="12" fill={purple} />
        <text x="150" y="304" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="14" fill="white">User</text>
        {[
          ["id", "string", "PK"],
          ["email", "string", ""],
          ["name", "string", ""],
          ["role", "admin | user", ""],
          ["createdAt", "datetime", ""],
        ].map(([name, type, pk], i) => (
          <g key={String(name)}>
            <text x="45" y={340 + i * 18} fontFamily={font} fontSize="11" fill={pk === "PK" ? purple : dark} fontWeight={pk ? "700" : "400"}>{String(name)}</text>
            <text x="200" y={340 + i * 18} fontFamily={mono} fontSize="10" fill={blue}>{String(type)}</text>
          </g>
        ))}

        {/* ScheduledTask */}
        <rect x="330" y="280" width="240" height="160" rx="12" fill="white" stroke={amber} strokeWidth="1.5" />
        <rect x="330" y="280" width="240" height="36" rx="12" fill={amber} />
        <rect x="330" y="304" width="240" height="12" fill={amber} />
        <text x="450" y="304" textAnchor="middle" fontFamily={font} fontWeight="700" fontSize="14" fill="white">ScheduledTask</text>
        {[
          ["id", "serial", "PK"],
          ["name", "string", ""],
          ["command", "string", ""],
          ["cronExpr", "string", ""],
          ["targetType", "agent | group", ""],
          ["isActive", "boolean", ""],
        ].map(([name, type, pk], i) => (
          <g key={String(name)}>
            <text x="345" y={340 + i * 18} fontFamily={font} fontSize="11" fill={pk === "PK" ? amber : dark} fontWeight={pk ? "700" : "400"}>{String(name)}</text>
            <text x="500" y={340 + i * 18} fontFamily={mono} fontSize="10" fill={blue}>{String(type)}</text>
          </g>
        ))}

        {/* Permissions join table */}
        <rect x="630" y="280" width="240" height="120" rx="12" fill="white" stroke={muted} strokeWidth="1" strokeDasharray="6 3" />
        <text x="750" y="310" textAnchor="middle" fontFamily={font} fontWeight="600" fontSize="13" fill={muted}>user_agent_permissions</text>
        {[
          ["user_id", "FK -> User"],
          ["agent_id", "FK -> Agent"],
        ].map(([name, type], i) => (
          <g key={String(name)}>
            <text x="645" y={340 + i * 18} fontFamily={font} fontSize="11" fill={amber} fontWeight="600">{String(name)}</text>
            <text x="810" y={340 + i * 18} fontFamily={mono} fontSize="10" fill={muted}>{String(type)}</text>
          </g>
        ))}

        {/* Relations */}
        <path d="M270 80 L330 80" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" fill="none" markerEnd="url(#mArr)" />
        <text x="298" y="73" fontFamily={mono} fontSize="9" fill={muted}>1:N</text>
        <path d="M270 360 L630 340" stroke="rgba(0,0,0,0.15)" strokeWidth="1" strokeDasharray="5 3" fill="none" markerEnd="url(#mArr)" />
        <path d="M150 240 Q150 420 630 360" stroke="rgba(0,0,0,0.15)" strokeWidth="1" strokeDasharray="5 3" fill="none" markerEnd="url(#mArr)" />
        <path d="M200 240 Q300 260 350 310" stroke="rgba(0,0,0,0.15)" strokeWidth="1" strokeDasharray="5 3" fill="none" markerEnd="url(#mArr)" />
      </svg>
    </div>
  );
}
