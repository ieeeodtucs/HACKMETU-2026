import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_SANS } from "../fonts";
import { AnimatedText } from "../components/AnimatedText";
import { TerminalWindow } from "../components/TerminalWindow";
import { GlowingOrb } from "../components/GlowingOrb";

export const DemoSequence: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#231f20" }}>
      {/* Concentric circles bg */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 1000,
          height: 1000,
          transform: "translate(-50%, -50%)",
          background: `
            radial-gradient(circle, transparent 40%, rgba(255,203,8,0.02) 41%, transparent 42%),
            radial-gradient(circle, transparent 60%, rgba(255,203,8,0.015) 61%, transparent 62%),
            radial-gradient(circle, transparent 80%, rgba(255,203,8,0.01) 81%, transparent 82%)
          `,
          pointerEvents: "none",
        }}
      />

      <GlowingOrb x={200} y={200} size={300} color="#FFCB08" delay={0} />
      <GlowingOrb x={1700} y={900} size={250} color="#E6B700" delay={15} />

      <div style={{ position: "absolute", top: 35, left: 0, right: 0, textAlign: "center" }}>
        <AnimatedText text="DEMO" delay={8} fontSize={14} fontWeight={600} color="#FFCB08" style={{ letterSpacing: 6 }} />
      </div>
      <AnimatedText
        text="Nasıl Çalışır?"
        delay={18}
        fontSize={44}
        fontWeight={600}
        style={{ position: "absolute", top: 65, left: 0, right: 0, textAlign: "center" }}
      />

      {/* Two terminals — slower line reveals */}
      <div
        style={{
          position: "absolute",
          top: 175,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 40,
          alignItems: "flex-start",
        }}
      >
        <TerminalWindow
          title="kovan-server"
          delay={30}
          width={820}
          lines={[
            "$ cd server && bun run dev",
            "",
            "✓ Server started on port 4444",
            "✓ WebSocket endpoint: /ws/agent",
            "✓ REST API ready",
            "",
            "# Agent connected: pardus-PC",
            "  ID: a1b2c3d4  OS: linux",
            "  IP: 192.168.1.42",
            "",
            "# Heartbeat received: a1b2c3d4",
            "# Command dispatched → whoami",
          ]}
        />

        <TerminalWindow
          title="go-agent"
          delay={55}
          width={820}
          lines={[
            "$ ./pardus-agent --server ws://10.0.0.1:4444/ws/agent",
            "",
            "✓ Connected to KOVAN server",
            "✓ Registered as: a1b2c3d4",
            "✓ Heartbeat loop started (10s)",
            "",
            "> Received command: whoami",
            "  Executing: sh -c whoami",
            "  Output: pardus-user",
            "",
            "> Received command: cat /etc/os-release",
            "  Output: Pardus 23 (Yirmiüç)",
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};
