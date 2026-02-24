import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

export const GridBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 0.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const offsetY = interpolate(frame, [0, 450], [0, -100]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        backgroundImage: `
          linear-gradient(rgba(255,203,8,0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,203,8,0.3) 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
        backgroundPosition: `0 ${offsetY}px`,
      }}
    />
  );
};
