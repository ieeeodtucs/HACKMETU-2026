import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { slide } from "@remotion/transitions/slide";
import { IntroSequence } from "./sequences/IntroSequence";
import { ArchitectureSequence } from "./sequences/ArchitectureSequence";
import { FeaturesSequence } from "./sequences/FeaturesSequence";
import { DemoSequence } from "./sequences/DemoSequence";
import { OutroSequence } from "./sequences/OutroSequence";

export const KovanPromo: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#231f20" }}>
      <TransitionSeries>
        {/* Intro — 8s */}
        <TransitionSeries.Sequence durationInFrames={240}>
          <IntroSequence />
        </TransitionSeries.Sequence>

        {/* clockWipe — dramatic circular reveal */}
        <TransitionSeries.Transition
          presentation={clockWipe({ width, height })}
          timing={springTiming({
            config: { damping: 200 },
            durationInFrames: 40,
            durationRestThreshold: 0.001,
          })}
        />

        {/* Architecture — 7s */}
        <TransitionSeries.Sequence durationInFrames={210}>
          <ArchitectureSequence />
        </TransitionSeries.Sequence>

        {/* wipe — clean sweep to light */}
        <TransitionSeries.Transition
          presentation={wipe()}
          timing={linearTiming({ durationInFrames: 35 })}
        />

        {/* Features — 8s */}
        <TransitionSeries.Sequence durationInFrames={240}>
          <FeaturesSequence />
        </TransitionSeries.Sequence>

        {/* flip — page turn back to dark */}
        <TransitionSeries.Transition
          presentation={flip()}
          timing={springTiming({
            config: { damping: 200 },
            durationInFrames: 40,
            durationRestThreshold: 0.001,
          })}
        />

        {/* Demo — 7s */}
        <TransitionSeries.Sequence durationInFrames={210}>
          <DemoSequence />
        </TransitionSeries.Sequence>

        {/* slide from bottom — cinematic outro reveal */}
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-bottom" })}
          timing={springTiming({
            config: { damping: 200 },
            durationInFrames: 35,
            durationRestThreshold: 0.001,
          })}
        />

        {/* Outro — 5s */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <OutroSequence />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
