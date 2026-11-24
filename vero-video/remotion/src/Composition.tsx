import "@fontsource/rubik/hebrew-700.css";
import "@fontsource/rubik/latin-700.css";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";

export const SetupTest: React.FC = () => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 18], [0.35, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const bar = interpolate(frame, [9, 33], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const fadeOut = interpolate(frame, [78, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      dir="rtl"
      style={{
        backgroundColor: "#0e1726",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        fontFamily: "Rubik, sans-serif",
        opacity: fadeOut,
      }}
    >
      <h1
        style={{
          margin: 0,
          color: "#fff",
          fontSize: 120,
          fontWeight: 700,
          opacity: appear,
          transform: `translateY(${(1 - appear) * 24}px)`,
        }}
      >
        VERO — בדיקת התקנה
      </h1>
      <div
        style={{
          width: 640,
          height: 10,
          borderRadius: 5,
          backgroundColor: "#4fd1c5",
          transform: `scaleX(${bar})`,
          transformOrigin: "right center",
        }}
      />
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="SetupTest"
      component={SetupTest}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
