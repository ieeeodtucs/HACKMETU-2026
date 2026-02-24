import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Crosshair,
  Bug,
  Keyboard,
  ChartLineUp,
  WifiHigh,
  Timer,
  UsersThree,
  ShieldCheck,
} from "@phosphor-icons/react";
import { FONT_SANS } from "../fonts";
import { AnimatedText } from "../components/AnimatedText";
import { FeatureCard } from "../components/FeatureCard";

const features = [
  { icon: <Crosshair size={28} weight="duotone" color="#FFCB08" />, title: "Uzaktan Komut Yönetimi", description: "Agent'lara anlık komut gönderimi, stdout/stderr geri dönüşü" },
  { icon: <Bug size={28} weight="duotone" color="#FFCB08" />, title: "CVE Zafiyet Taraması", description: "47K+ CVE veritabanı, paket bazlı zafiyet tespiti" },
  { icon: <Keyboard size={28} weight="duotone" color="#FFCB08" />, title: "Keylogger", description: "Windows & Linux, pencere bazlı tuş kaydı" },
  { icon: <ChartLineUp size={28} weight="duotone" color="#FFCB08" />, title: "ATTDAP Anomali Tespiti", description: "3-model ensemble ML, ağ trafiği analizi" },
  { icon: <WifiHigh size={28} weight="duotone" color="#FFCB08" />, title: "Ağ Keşfi & Tarama", description: "Cihaz keşfi, açık port ve servis haritalama" },
  { icon: <Timer size={28} weight="duotone" color="#FFCB08" />, title: "Zamanlanmış Görevler", description: "Cron tabanlı otomatik komut çalıştırma" },
  { icon: <UsersThree size={28} weight="duotone" color="#FFCB08" />, title: "Agent Grupları", description: "Grup bazlı yönetim ve toplu komut gönderimi" },
  { icon: <ShieldCheck size={28} weight="duotone" color="#FFCB08" />, title: "Kimlik Doğrulama", description: "Better Auth, rol bazlı erişim kontrolü" },
];

export const FeaturesSequence: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: "#fafbff" }}>
      {/* Title */}
      <div style={{ position: "absolute", top: 45, left: 0, right: 0, textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 24px",
            background: "#FFF5CD",
            border: "1px solid rgba(255,203,8,0.3)",
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 600,
            color: "#231f20",
            fontFamily: FONT_SANS,
            marginBottom: 16,
            opacity: interpolate(frame - 8, [0, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Takipte Kalın
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 95,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame - 18, [0, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(frame - 18, [0, 25], [30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        <span style={{ fontSize: 44, fontWeight: 600, fontFamily: FONT_SANS, color: "#231f20" }}>
          <span style={{ color: "#FFCB08" }}>Kovan</span>'da neler var?
        </span>
      </div>

      {/* Feature cards — 2 rows of 4, generous stagger */}
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          {features.slice(0, 4).map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} description={f.description}
              delay={40 + i * 15} index={i} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          {features.slice(4, 8).map((f, i) => (
            <FeatureCard key={i + 4} icon={f.icon} title={f.title} description={f.description}
              delay={105 + i * 15} index={i + 4} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
