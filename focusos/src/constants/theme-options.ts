import type { FocusSceneId } from "@/constants/focus-scenes";
import type { AppTheme } from "@/types/user.types";

export type ThemeAppearance = "light" | "dark";

export type ThemeOption = {
  id: AppTheme;
  label: string;
  description: string;
  swatches: Record<ThemeAppearance, string[]>;
  sceneId: FocusSceneId;
  images: Record<ThemeAppearance, string>;
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Reduced contrast for quiet planning.",
    swatches: {
      light: ["#a08060", "#907050", "#806040"],
      dark: ["#604020", "#402010", "#201008"],
    },
    sceneId: "train-window",
    images: {
      light: "/scenes/minimal_light.png",
      dark: "/scenes/minimal_dark.png",
    },
  },
  {
    id: "forest",
    label: "Forest",
    description: "Original green workspace.",
    swatches: {
      light: ["#201010", "#302010", "#e0e0e0"],
      dark: ["#201000", "#001010", "#101000"],
    },
    sceneId: "forest-cabin",
    images: {
      light: "/scenes/forest_light.png",
      dark: "/scenes/forest_dark.png",
    },
  },
  {
    id: "aurora-night",
    label: "Aurora",
    description: "Muted aurora atmosphere.",
    swatches: {
      light: ["#101010", "#202030", "#203040"],
      dark: ["#001020", "#001030", "#102040"],
    },
    sceneId: "da-lat-mist",
    images: {
      light: "/scenes/da-lat-mist_light.webp",
      dark: "/scenes/da_lat_mist_dark.png",
    },
  },
  {
    id: "rain-room",
    label: "Rainroom",
    description: "Cooler reading surface.",
    swatches: {
      light: ["#101000", "#201000", "#404040"],
      dark: ["#101000", "#201000", "#404040"],
    },
    sceneId: "rainy-cafe",
    images: {
      light: "/scenes/rain.png",
      dark: "/scenes/rain.png",
    },
  },
];

export function getThemeOption(id: AppTheme | string | null | undefined): ThemeOption {
  return (
    THEME_OPTIONS.find((option) => option.id === id) ??
    THEME_OPTIONS.find((option) => option.id === "forest") ??
    THEME_OPTIONS[0]
  );
}

export function getThemeImage(
  option: ThemeOption,
  appearance: ThemeAppearance
): string {
  return option.images[appearance] ?? option.images.dark ?? option.images.light;
}

export function getThemeSwatches(
  option: ThemeOption,
  appearance: ThemeAppearance
): string[] {
  return option.swatches[appearance] ?? option.swatches.dark ?? option.swatches.light;
}
