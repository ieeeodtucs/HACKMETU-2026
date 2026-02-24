import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_MONO } from "../fonts";

interface TerminalWindowProps {
  lines: string[];
  delay?: number;
  title?: string;
  width?: number;
}

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  lines,
  delay = 0,
  title = "terminal",
  width = 800,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        background: "rgba(26, 26, 30, 0.95)",
        borderRadius: 16,
        border: "1px solid rgba(255,203,8,0.15)",
        overflow: "hidden",
        opacity,
        transform: `scale(${Math.min(scale, 1)})`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(255,203,8,0.05)",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          padding: "12px 18px",
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f56" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffbd2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#27c93f" }} />
        <span
          style={{
            marginLeft: 12,
            color: "rgba(255,255,255,0.4)",
            fontSize: 14,
            fontFamily: FONT_MONO,
          }}
        >
          {title}
        </span>
      </div>
      {/* Content */}
      <div style={{ padding: "24px 28px" }}>
        {lines.map((line, i) => {
          const lineDelay = delay + 15 + i * 8;
          const lineOpacity = interpolate(frame - lineDelay, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isPrompt = line.startsWith("$") || line.startsWith(">");
          const isComment = line.startsWith("#");
          const isSuccess = line.startsWith("✓") || line.startsWith("✔");

          let color = "rgba(255,255,255,0.8)";
          if (isPrompt) color = "#FFCB08";
          if (isComment) color = "rgba(255,255,255,0.3)";
          if (isSuccess) color = "#FFCB08";

          return (
            <div
              key={i}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 15,
                color,
                opacity: lineOpacity,
                lineHeight: 1.9,
                whiteSpace: "pre",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};
