export type FigureStar = {
  id: string;
  label?: string;
  rightAscensionHours: number;
  declinationDegrees: number;
  magnitude?: number;
};

export type SkyFigure = {
  targetId: string;
  name: string;
  kind: "constellation" | "asterism" | "cluster";
  stars: FigureStar[];
  segments: Array<readonly [string, string]>;
};

// J2000/ICRS positions are rounded from the CDS SIMBAD bright-star records.
// These connecting strokes are SkyQuest teaching figures: the IAU standardizes
// constellation boundaries, not an official set of lines between their stars.
export const skyFigures: SkyFigure[] = [
  {
    targetId: "ursa-major",
    name: "Grande Ourse",
    kind: "asterism",
    stars: [
      { id: "dubhe", label: "Dubhe", rightAscensionHours: 11.0621, declinationDegrees: 61.7508, magnitude: 1.79 },
      { id: "merak", rightAscensionHours: 11.0307, declinationDegrees: 56.3824, magnitude: 2.37 },
      { id: "phecda", rightAscensionHours: 11.8972, declinationDegrees: 53.6948, magnitude: 2.44 },
      { id: "megrez", rightAscensionHours: 12.2571, declinationDegrees: 57.0326, magnitude: 3.31 },
      { id: "alioth", rightAscensionHours: 12.9005, declinationDegrees: 55.9598, magnitude: 1.76 },
      { id: "mizar", rightAscensionHours: 13.3987, declinationDegrees: 54.9254, magnitude: 2.23 },
      { id: "alkaid", rightAscensionHours: 13.7923, declinationDegrees: 49.3133, magnitude: 1.85 },
    ],
    segments: [
      ["dubhe", "merak"], ["merak", "phecda"], ["phecda", "megrez"], ["megrez", "dubhe"],
      ["megrez", "alioth"], ["alioth", "mizar"], ["mizar", "alkaid"],
    ],
  },
  {
    targetId: "cassiopeia",
    name: "Cassiopée",
    kind: "constellation",
    stars: [
      { id: "caph", rightAscensionHours: 0.1529, declinationDegrees: 59.1498, magnitude: 2.28 },
      { id: "schedar", rightAscensionHours: 0.6751, declinationDegrees: 56.5373, magnitude: 2.24 },
      { id: "navi", rightAscensionHours: 0.9451, declinationDegrees: 60.7167, magnitude: 2.15 },
      { id: "ruchbah", rightAscensionHours: 1.4303, declinationDegrees: 60.2353, magnitude: 2.68 },
      { id: "segin", rightAscensionHours: 1.9066, declinationDegrees: 63.67, magnitude: 3.35 },
    ],
    segments: [["caph", "schedar"], ["schedar", "navi"], ["navi", "ruchbah"], ["ruchbah", "segin"]],
  },
  {
    targetId: "summer-triangle",
    name: "Triangle d’été",
    kind: "asterism",
    stars: [
      { id: "vega", label: "Véga", rightAscensionHours: 18.6156, declinationDegrees: 38.7837, magnitude: 0.03 },
      { id: "deneb", label: "Deneb", rightAscensionHours: 20.6905, declinationDegrees: 45.2803, magnitude: 1.25 },
      { id: "altair", label: "Altaïr", rightAscensionHours: 19.8464, declinationDegrees: 8.8683, magnitude: 0.77 },
    ],
    segments: [["vega", "deneb"], ["deneb", "altair"], ["altair", "vega"]],
  },
  {
    targetId: "pleiades",
    name: "Pléiades",
    kind: "cluster",
    stars: [
      { id: "alcyone", label: "Pléiades", rightAscensionHours: 3.7914, declinationDegrees: 24.1051, magnitude: 2.87 },
      { id: "atlas", rightAscensionHours: 3.8194, declinationDegrees: 24.0534, magnitude: 3.63 },
      { id: "pleione", rightAscensionHours: 3.8198, declinationDegrees: 24.1367, magnitude: 5.05 },
      { id: "electra", rightAscensionHours: 3.7479, declinationDegrees: 24.1133, magnitude: 3.7 },
      { id: "maia", rightAscensionHours: 3.7638, declinationDegrees: 24.3678, magnitude: 3.87 },
      { id: "merope", rightAscensionHours: 3.7721, declinationDegrees: 23.9484, magnitude: 4.18 },
      { id: "taygeta", rightAscensionHours: 3.7535, declinationDegrees: 24.4673, magnitude: 4.3 },
      { id: "celaeno", rightAscensionHours: 3.7467, declinationDegrees: 24.2895, magnitude: 5.45 },
    ],
    segments: [["atlas", "pleione"], ["electra", "alcyone"], ["alcyone", "maia"], ["alcyone", "merope"], ["maia", "taygeta"], ["maia", "celaeno"]],
  },
];

export function getSkyFigure(targetId: string): SkyFigure | null {
  return skyFigures.find((figure) => figure.targetId === targetId) ?? null;
}
