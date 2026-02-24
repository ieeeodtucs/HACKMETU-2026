import React from "react";
import { useCurrentFrame } from "remotion";

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export const ParticleField: React.FC<{ count?: number }> = ({ count = 40 }) => {
  const frame = useCurrentFrame();

  const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
    x: seededRandom(i * 3 + 1) * 1920,
    y: seededRandom(i * 3 + 2) * 1080,
    size: seededRandom(i * 3 + 3) * 3 + 1,
    speed: seededRandom(i * 7) * 0.5 + 0.2,
    opacity: seededRandom(i * 11) * 0.4 + 0.1,
  }));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {particles.map((p, i) => {
        const y = (p.y - frame * p.speed * 2) % 1080;
        const adjustedY = y < 0 ? y + 1080 : y;
        const flicker = Math.sin(frame * 0.1 + i) * 0.3 + 0.7;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              top: adjustedY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: i % 3 === 0 ? "#FFCB08" : "rgba(255,255,255,0.6)",
              opacity: p.opacity * flicker,
            }}
          />
        );
      })}
    </div>
  );
};
