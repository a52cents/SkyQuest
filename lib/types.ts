export type SkyObjectName = "Moon" | "Venus" | "Jupiter" | "Saturn" | "Mars";

export type SkyObject = {
  name: SkyObjectName;
  azimuth: number;
  altitude: number;
  magnitudeHint: "very-bright" | "bright" | "medium";
};

export type WeatherNow = {
  cloudCover: number;
  isDay: boolean;
  temperature?: number;
};

export type VisibilityLabel = "Excellente chance" | "Bonne chance" | "Tentable" | "Pas conseillé";

export type SkyQuest = {
  id: string;
  target: SkyObjectName | "FreeObservation";
  title: string;
  difficulty: "easy" | "medium";
  azimuth: number | null;
  altitude: number | null;
  cardinalDirection: string | null;
  visibilityScore: number;
  visibilityLabel: string;
  description: string;
  tip: string;
};

export type Observation = {
  id: string;
  createdAt: string;
  questTitle: string;
  target: string;
  status: "seen" | "missed";
  visibilityScore: number;
  latitude?: number;
  longitude?: number;
};
