import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { VeroInspection } from "./vero/VeroInspection";
import { DURATION_S, FPS } from "./vero/timeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VeroInspection"
        component={VeroInspection}
        durationInFrames={DURATION_S * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <MyComposition />
    </>
  );
};
