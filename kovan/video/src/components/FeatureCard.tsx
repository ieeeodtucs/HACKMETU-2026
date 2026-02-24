import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS } from "../fonts";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
  index?: number;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay = 0,
  index = 0,
}) => {
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

  const translateY = interpolate(frame - delay, [0, 25], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Alternate card styles like landing page bento
  const isDark = index % 3 === 1;
  const isAccent = index % 3 === 2;

  const bg = isDark ? "#1a1a1e" : isAccent ? "#1a1a1e" : "#ffffff";
  const borderColor = isAccent ? "rgba(255,203,8,0.4)" : isDark ? "transparent" : "rgba(35,31,32,0.08)";
  const titleColor = isAccent ? "#FFCB08" : isDark ? "#fff" : "#231f20";
  const descColor = isDark || isAccent ? "rgba(255,255,255,0.5)" : "rgba(35,31,32,0.5)";
  const iconBg = isDark ? "rgba(255,203,8,0.12)" : isAccent ? "rgba(255,203,8,0.15)" : "#FFF5CD";

  return (
    <div
      style={{
        width: 340,
        padding: "32px 28px",
        background: bg,
        borderRadius: 24,
        border: `1px solid ${borderColor}`,
        opacity,
        transform: `translateY(${translateY}px) scale(${Math.min(scale, 1)})`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: titleColor,
          marginBottom: 8,
          fontFamily: FONT_SANS,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: descColor,
          lineHeight: 1.6,
          fontFamily: FONT_SANS,
        }}
      >
        {description}
      </div>
    </div>
  );
};
