import { Composition } from "remotion";
import { KovanPromo } from "./KovanPromo";
import "./fonts";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="KovanPromo"
      component={KovanPromo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
