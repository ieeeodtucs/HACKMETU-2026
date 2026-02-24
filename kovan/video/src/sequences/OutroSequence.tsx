import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GithubLogo, RocketLaunch } from "@phosphor-icons/react";
import { FONT_SANS, FONT_MONO } from "../fonts";
import { AnimatedText } from "../components/AnimatedText";
import { GlowingOrb } from "../components/GlowingOrb";
import { ParticleField } from "../components/ParticleField";

export const OutroSequence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineWidth = interpolate(frame - 50, [0, 35], [0, 500], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const btnScale = spring({
    frame: frame - 85,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ background: "#231f20" }}>
      {/* Concentric gold circles */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 1000,
          height: 1000,
          transform: "translate(-50%, -50%)",
          background: `
            radial-gradient(circle, transparent 25%, rgba(255,203,8,0.04) 26%, transparent 27%),
            radial-gradient(circle, transparent 40%, rgba(255,203,8,0.03) 41%, transparent 42%),
            radial-gradient(circle, transparent 55%, rgba(255,203,8,0.025) 56%, transparent 57%),
            radial-gradient(circle, transparent 70%, rgba(255,203,8,0.02) 71%, transparent 72%),
            radial-gradient(circle, transparent 85%, rgba(255,203,8,0.015) 86%, transparent 87%)
          `,
          pointerEvents: "none",
        }}
      />

      <ParticleField count={50} />
      <GlowingOrb x={960} y={540} size={700} color="#FFCB08" delay={0} />
      <GlowingOrb x={500} y={300} size={300} color="#E6B700" delay={15} />
      <GlowingOrb x={1400} y={700} size={300} color="#FFCB08" delay={25} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <AnimatedText
          text="KOVAN"
          delay={15}
          fontSize={120}
          fontWeight={600}
          color="#fff"
          letterByLetter
          style={{ letterSpacing: 8 }}
        />

        <div
          style={{
            width: lineWidth,
            height: 1,
            background: "linear-gradient(90deg, transparent, #FFCB08, transparent)",
            marginTop: 8,
            marginBottom: 8,
          }}
        />

        <AnimatedText
          text="Kovan ile Geleceğe Adım Atın"
          delay={45}
          fontSize={30}
          fontWeight={300}
          color="rgba(255,255,255,0.6)"
          style={{ letterSpacing: 2 }}
        />

        {/* CTA button */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 40px",
            borderRadius: 100,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: FONT_SANS,
            background: "#FFCB08",
            color: "#231f20",
            marginTop: 28,
            opacity: interpolate(frame - 85, [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `scale(${Math.min(btnScale, 1)})`,
            boxShadow: "0 8px 24px rgba(255,203,8,0.25)",
          }}
        >
          <RocketLaunch size={18} weight="bold" />
          Hemen Başla
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 24,
            opacity: interpolate(frame - 70, [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <GithubLogo size={24} weight="fill" color="rgba(255,255,255,0.4)" />
          <span style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", fontFamily: FONT_MONO }}>
            github.com/byigitt/kovan
          </span>
        </div>

        <AnimatedText
          text="HACKMETU 2026"
          delay={90}
          fontSize={14}
          fontWeight={600}
          color="#FFCB08"
          style={{ letterSpacing: 6, marginTop: 35 }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
