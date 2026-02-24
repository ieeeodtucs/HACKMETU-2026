import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT_SANS } from "../fonts";
import { AnimatedText } from "../components/AnimatedText";
import { GlowingOrb } from "../components/GlowingOrb";
import { ParticleField } from "../components/ParticleField";

export const IntroSequence: React.FC = () => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scanLineY = interpolate(frame, [30, 90], [-100, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const circleOpacity = interpolate(frame, [15, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const circleScale = interpolate(frame, [15, 120], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#231f20", opacity: bgOpacity }}>
      {/* Pardus concentric gold circles */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 900,
          height: 900,
          transform: `translate(-50%, -50%) scale(${circleScale})`,
          opacity: circleOpacity,
          background: `
            radial-gradient(circle, transparent 30%, rgba(255,203,8,0.04) 31%, transparent 32%),
            radial-gradient(circle, transparent 45%, rgba(255,203,8,0.03) 46%, transparent 47%),
            radial-gradient(circle, transparent 60%, rgba(255,203,8,0.025) 61%, transparent 62%),
            radial-gradient(circle, transparent 75%, rgba(255,203,8,0.02) 76%, transparent 77%),
            radial-gradient(circle, transparent 90%, rgba(255,203,8,0.015) 91%, transparent 92%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Flowing golden arcs */}
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "-10%",
          width: "120%",
          height: "90%",
          background: `
            radial-gradient(ellipse 90% 60% at 20% 80%, rgba(255,203,8,0.07) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 80% 70%, rgba(255,203,8,0.05) 0%, transparent 50%),
            radial-gradient(ellipse 50% 80% at 50% 90%, rgba(255,203,8,0.04) 0%, transparent 50%)
          `,
          pointerEvents: "none",
        }}
      />

      <ParticleField count={30} />
      <GlowingOrb x={960} y={400} size={500} color="#FFCB08" delay={10} />
      <GlowingOrb x={400} y={600} size={300} color="#FFCB08" delay={25} />
      <GlowingOrb x={1500} y={300} size={250} color="#E6B700" delay={40} />

      {/* Scan line */}
      {frame > 30 && frame < 95 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: scanLineY,
            height: 2,
            background: "linear-gradient(90deg, transparent, #FFCB08, transparent)",
            boxShadow: "0 0 20px #FFCB08, 0 0 60px rgba(255,203,8,0.3)",
          }}
        />
      )}

      {/* Center content */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Pill badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 24px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            fontFamily: FONT_SANS,
            opacity: interpolate(frame - 20, [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame - 20, [0, 25], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          HACKMETU 2026
        </div>

        {/* Main title */}
        <AnimatedText
          text="KOVAN"
          delay={45}
          fontSize={140}
          fontWeight={600}
          color="#fff"
          letterByLetter
          style={{ letterSpacing: 8 }}
        />

        {/* Subtitle with accent */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 300,
            fontFamily: FONT_SANS,
            letterSpacing: 2,
            opacity: interpolate(frame - 80, [0, 25], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(frame - 80, [0, 30], [40, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)" }}>Siber Güvenlikte </span>
          <span style={{ color: "#FFCB08" }}>Özgürleşin</span>
        </div>

        {/* Divider line */}
        <div
          style={{
            width: interpolate(frame - 110, [0, 30], [0, 400], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 1,
            background: "linear-gradient(90deg, transparent, #FFCB08, transparent)",
            marginTop: 8,
          }}
        />

        {/* Tech stack */}
        <AnimatedText
          text="Bun • TypeScript • Go • React"
          delay={130}
          fontSize={22}
          fontWeight={400}
          color="rgba(255,255,255,0.4)"
          style={{ letterSpacing: 3, marginTop: 8 }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
