import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS } from "../fonts";

interface AnimatedTextProps {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  style?: React.CSSProperties;
  letterByLetter?: boolean;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  fontSize = 48,
  color = "#ffffff",
  fontWeight = 700,
  style = {},
  letterByLetter = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (letterByLetter) {
    return (
      <div style={{ display: "flex", ...style }}>
        {text.split("").map((char, i) => {
          const charDelay = delay + i * 3;
          const scale = spring({
            frame: frame - charDelay,
            fps,
            config: { damping: 12, stiffness: 200 },
          });
          const opacity = interpolate(frame - charDelay, [0, 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={i}
              style={{
                fontSize,
                color,
                fontWeight,
                fontFamily: FONT_SANS,
                transform: `scale(${scale})`,
                opacity,
                display: "inline-block",
                whiteSpace: "pre",
              }}
            >
              {char}
            </span>
          );
        })}
      </div>
    );
  }

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame - delay, [0, 25], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontSize,
        color,
        fontWeight,
        fontFamily: FONT_SANS,
        opacity,
        transform: `translateY(${translateY}px) scale(${Math.min(scale, 1)})`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
