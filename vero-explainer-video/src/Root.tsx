import { Composition } from 'remotion';
import { VeroExplainer, VIDEO } from './Video';
export const RemotionRoot: React.FC = () => (
  <Composition
    id="VeroExplainer"
    component={VeroExplainer}
    durationInFrames={VIDEO.durationInFrames}
    fps={VIDEO.fps}
    width={1920}
    height={1080}
  />
);
