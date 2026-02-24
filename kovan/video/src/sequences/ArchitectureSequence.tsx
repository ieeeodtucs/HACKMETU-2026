import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Desktop,
  Robot,
  ChartBar,
  Database,
  Keyboard,
  Brain,
  Camera,
} from "@phosphor-icons/react";
import { FONT_SANS } from "../fonts";
import { AnimatedText } from "../components/AnimatedText";
import { GlowingOrb } from "../components/GlowingOrb";

interface NodeProps {
  label: string;
  sublabel: string;
  x: number;
  y: number;
  delay: number;
  color: string;
  icon: React.ReactNode;
}

const ArchNode: React.FC<NodeProps> = ({ label, sublabel, x, y, delay, color, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = Math.sin((frame - delay) * 0.06) * 3;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${Math.min(scale, 1)})`,
        opacity,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 90 + pulse,
          height: 90 + pulse,
          borderRadius: 20,
          background: `radial-gradient(circle, ${color}22, ${color}08)`,
          border: `2px solid ${color}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
          boxShadow: `0 0 30px ${color}15`,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", fontFamily: FONT_SANS }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: FONT_SANS, marginTop: 4 }}>
        {sublabel}
      </div>
    </div>
  );
};

interface ConnectionProps {
  x1: number; y1: number; x2: number; y2: number;
  delay: number; color?: string;
}

const Connection: React.FC<ConnectionProps> = ({ x1, y1, x2, y2, delay, color = "#FFCB08" }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame - delay, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame - delay, [0, 15], [0, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const packetPos = ((frame - delay) * 0.02) % 1;
  const packetX = x1 + (x2 - x1) * packetPos;
  const packetY = y1 + (y2 - y1) * packetPos;

  return (
    <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={1920} height={1080}>
      <line
        x1={x1} y1={y1}
        x2={x1 + (x2 - x1) * progress}
        y2={y1 + (y2 - y1) * progress}
        stroke={color} strokeWidth={2} opacity={opacity} strokeDasharray="8,4"
      />
      {progress > 0.3 && (
        <circle cx={packetX} cy={packetY} r={4} fill={color} opacity={0.8}>
          <animate attributeName="r" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
};

const iconProps = { size: 36, weight: "duotone" as const };

export const ArchitectureSequence: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#231f20" }}>
      {/* Concentric circles */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 800,
          height: 800,
          transform: "translate(-50%, -50%)",
          background: `
            radial-gradient(circle, transparent 30%, rgba(255,203,8,0.03) 31%, transparent 32%),
            radial-gradient(circle, transparent 45%, rgba(255,203,8,0.025) 46%, transparent 47%),
            radial-gradient(circle, transparent 60%, rgba(255,203,8,0.02) 61%, transparent 62%),
            radial-gradient(circle, transparent 75%, rgba(255,203,8,0.015) 76%, transparent 77%)
          `,
          pointerEvents: "none",
        }}
      />
      <GlowingOrb x={960} y={540} size={600} color="#FFCB08" delay={0} />

      <div style={{ position: "absolute", top: 50, left: 0, right: 0, textAlign: "center" }}>
        <AnimatedText text="MİMARİ" delay={8} fontSize={14} fontWeight={600} color="#FFCB08" style={{ letterSpacing: 6 }} />
      </div>
      <AnimatedText
        text="Güçlü ve Esnek Mimari"
        delay={18}
        fontSize={44}
        fontWeight={600}
        style={{ position: "absolute", top: 80, left: 0, right: 0, textAlign: "center" }}
      />

      {/* Connections — slower delays */}
      <Connection x1={960} y1={380} x2={400} y2={600} delay={70} color="#FFCB08" />
      <Connection x1={960} y1={380} x2={1520} y2={600} delay={78} color="#FFCB08" />
      <Connection x1={960} y1={380} x2={960} y2={700} delay={86} color="#E6B700" />
      <Connection x1={400} y1={600} x2={400} y2={850} delay={110} color="rgba(255,203,8,0.6)" />
      <Connection x1={1520} y1={600} x2={1520} y2={850} delay={118} color="rgba(255,203,8,0.6)" />

      {/* Nodes — staggered appearance */}
      <ArchNode label="KOVAN Server" sublabel="Bun + Hono • Port 4444"
        x={960} y={340} delay={28} color="#FFCB08"
        icon={<Desktop {...iconProps} color="#FFCB08" />} />
      <ArchNode label="Go Agent" sublabel="WebSocket • Auto-reconnect"
        x={400} y={560} delay={45} color="#FFCB08"
        icon={<Robot {...iconProps} color="#FFCB08" />} />
      <ArchNode label="React Dashboard" sublabel="Vite • Real-time UI"
        x={1520} y={560} delay={55} color="#FFCB08"
        icon={<ChartBar {...iconProps} color="#FFCB08" />} />
      <ArchNode label="PostgreSQL" sublabel="CVE DB • Auth • Scheduler"
        x={960} y={700} delay={65} color="#E6B700"
        icon={<Database {...iconProps} color="#E6B700" />} />
      <ArchNode label="Keylogger" sublabel="Win32 / Linux evdev"
        x={400} y={850} delay={95} color="rgba(255,203,8,0.7)"
        icon={<Keyboard {...iconProps} color="#FFCB08" />} />
      <ArchNode label="ATTDAP ML" sublabel="Anomaly Detection • FastAPI"
        x={1520} y={850} delay={105} color="rgba(255,203,8,0.7)"
        icon={<Brain {...iconProps} color="#FFCB08" />} />
      <ArchNode label="Screen Capture" sublabel="ffmpeg • x11grab • PowerShell"
        x={960} y={920} delay={115} color="rgba(255,203,8,0.7)"
        icon={<Camera {...iconProps} color="#FFCB08" />} />
    </AbsoluteFill>
  );
};
