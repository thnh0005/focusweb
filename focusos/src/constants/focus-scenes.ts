import type { AmbientLoopId, MusicTrackId } from "./ambient-tracks";

export type FocusSceneId =
  | "rainy-cafe"
  | "forest-cabin"
  | "night-study"
  | "hobbit-library"
  | "train-window"
  | "da-lat-mist";

export type SceneMotionType =
  | "rain"
  | "fireplace"
  | "forestNight"
  | "cityNight"
  | "trainWindow"
  | "mountainMist";

export type FocusSceneMotionType = SceneMotionType;

export interface FocusScenePalette {
  base: string;
  surface: string;
  accent: string;
  text: string;
  overlay: string;
  glow: string;
}

export interface FocusScene {
  id: FocusSceneId;
  name: string;
  description: string;
  image: string;
  ambientLabel: string;
  ambientId: AmbientLoopId;
  motionType: SceneMotionType;
  musicId: MusicTrackId;
  ambientMix?: Partial<Record<AmbientLoopId, number>>;
  palette: FocusScenePalette;
}

export const DEFAULT_FOCUS_SCENE_ID: FocusSceneId = "night-study";
export const DEFAULT_SCENE_ID = DEFAULT_FOCUS_SCENE_ID;

export const FOCUS_SCENES: FocusScene[] = [
  {
    id: "rainy-cafe",
    name: "Rainy Cafe",
    description: "Warm cafe lights, rain outside, low room tone for steady study.",
    image: "/scenes/rainy-cafe.webp",
    ambientLabel: "Rain",
    ambientId: "rain",
    motionType: "rain",
    musicId: "lofi-rain-01",
    ambientMix: { rain: 62, cafe: 10 },
    palette: {
      base: "#0d0b08",
      surface: "rgba(42, 33, 24, 0.54)",
      accent: "#d6b17a",
      text: "#f5ead5",
      overlay: "rgba(9, 7, 5, 0.58)",
      glow: "rgba(214, 177, 122, 0.22)",
    },
  },
  {
    id: "forest-cabin",
    name: "Forest Cabin",
    description: "Quiet wooden cabin, soft rain and fireplace for long focus blocks.",
    image: "/scenes/forest-cabin.webp",
    ambientLabel: "Fireplace",
    ambientId: "fireplace",
    motionType: "fireplace",
    musicId: "lofi-rain-01",
    ambientMix: { fireplace: 52, rain: 32, "forest-night": 18 },
    palette: {
      base: "#0a100c",
      surface: "rgba(28, 40, 28, 0.56)",
      accent: "#b8c891",
      text: "#edf3df",
      overlay: "rgba(5, 9, 6, 0.6)",
      glow: "rgba(124, 171, 145, 0.24)",
    },
  },
  {
    id: "night-study",
    name: "Night Study",
    description: "Dim desk, deep blue shadows, piano for late reading.",
    image: "/scenes/night-study.webp",
    ambientLabel: "Room tone",
    ambientId: "cafe",
    motionType: "cityNight",
    musicId: "soft-piano-01",
    ambientMix: { cafe: 22, "forest-night": 10 },
    palette: {
      base: "#070911",
      surface: "rgba(18, 23, 40, 0.58)",
      accent: "#9db7ff",
      text: "#eef3ff",
      overlay: "rgba(5, 7, 13, 0.64)",
      glow: "rgba(112, 146, 255, 0.2)",
    },
  },
  {
    id: "hobbit-library",
    name: "Hobbit Library",
    description: "Round-window library with warm fire and slow pages.",
    image: "/scenes/hobbit-library.webp",
    ambientLabel: "Fireplace",
    ambientId: "fireplace",
    motionType: "fireplace",
    musicId: "soft-piano-01",
    ambientMix: { fireplace: 62, "forest-night": 10 },
    palette: {
      base: "#140e08",
      surface: "rgba(70, 45, 23, 0.55)",
      accent: "#e2ad63",
      text: "#fff1d8",
      overlay: "rgba(13, 8, 4, 0.6)",
      glow: "rgba(226, 173, 99, 0.24)",
    },
  },
  {
    id: "train-window",
    name: "Train Window",
    description: "Moving window light with rain ambience for calm review sessions.",
    image: "/scenes/train-window.webp",
    ambientLabel: "Rain",
    ambientId: "rain",
    motionType: "trainWindow",
    musicId: "soft-piano-01",
    ambientMix: { rain: 18, cafe: 14 },
    palette: {
      base: "#160b0d",
      surface: "rgba(54, 28, 29, 0.54)",
      accent: "#f09a66",
      text: "#fff0df",
      overlay: "rgba(13, 7, 8, 0.62)",
      glow: "rgba(240, 154, 102, 0.2)",
    },
  },
  {
    id: "da-lat-mist",
    name: "Da Lat Mist",
    description: "Cool morning mist, pine air, and soft piano for gentle focus.",
    image: "/scenes/da-lat-mist.webp",
    ambientLabel: "Forest night",
    ambientId: "forest-night",
    motionType: "mountainMist",
    musicId: "soft-piano-01",
    ambientMix: { "forest-night": 36, rain: 8 },
    palette: {
      base: "#0b1118",
      surface: "rgba(28, 43, 58, 0.54)",
      accent: "#a9c8ee",
      text: "#edf7ff",
      overlay: "rgba(5, 9, 14, 0.55)",
      glow: "rgba(148, 190, 232, 0.22)",
    },
  },
];

export function getFocusScene(id: string | null | undefined): FocusScene {
  return (
    FOCUS_SCENES.find((scene) => scene.id === id) ??
    FOCUS_SCENES.find((scene) => scene.id === DEFAULT_FOCUS_SCENE_ID) ??
    FOCUS_SCENES[0]
  );
}
