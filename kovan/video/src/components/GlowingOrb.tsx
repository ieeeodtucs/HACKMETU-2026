import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface GlowingOrbProps {
  x: number;
  y: number;
  size?: number;
  color?: string;
  delay?: number;
}

export const GlowingOrb: React.FC<GlowingOrbProps> = ({
  x,
  y,
  size = 300,
  color = "#FFCB08",
  delay = 0,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame - delay, [0, 30], [0, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = Math.sin((frame - delay) * 0.05) * 20;

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size + pulse,
        height: size + pulse,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}44, ${color}11, transparent)`,
        opacity,
        filter: `blur(${size * 0.3}px)`,
        pointerEvents: "none",
      }}
    />
  );
};
