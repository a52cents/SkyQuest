import type { RequiredGear } from "@/lib/types";

export type CatalogObjectType =
  "star" | "asterism" | "constellation" | "star_cluster" | "galaxy" | "meteor_shower" | "satellite";

export type CatalogSkyObject = {
  id: string;
  name: string;
  frenchName: string;
  type: CatalogObjectType;
  rightAscensionHours?: number;
  declinationDegrees?: number;
  requiredGear: RequiredGear;
  difficulty: "easy" | "medium" | "hard";
  franceFriendly: boolean;
  seasonHint?: string;
  priority: number;
  questTitle: string;
  description: string;
  observationTip: string;
  warning?: string;
};

export const catalogSkyObjects: CatalogSkyObject[] = [
  {
    id: "iss",
    name: "ISS",
    frenchName: "ISS",
    type: "satellite",
    requiredGear: "naked_eye",
    difficulty: "easy",
    franceFriendly: true,
    priority: 95,
    questTitle: "Repère l'ISS",
    description: "Passage visible uniquement si une source satellite est configurée.",
    observationTip:
      "Elle ressemble à une étoile très brillante qui traverse lentement le ciel sans clignoter.",
  },
  {
    id: "polaris",
    name: "Polaris",
    frenchName: "Étoile Polaire",
    type: "star",
    rightAscensionHours: 2.5303,
    declinationDegrees: 89.2641,
    requiredGear: "naked_eye",
    difficulty: "medium",
    franceFriendly: true,
    priority: 82,
    questTitle: "Trouve l'Étoile Polaire",
    description: "Un bon repère pour apprendre le Nord. Elle reste presque fixe dans le ciel.",
    observationTip: "Regarde vers le Nord. Elle reste presque fixe dans le ciel.",
  },
  {
    id: "ursa-major",
    name: "Ursa Major",
    frenchName: "Grande Ourse",
    type: "asterism",
    rightAscensionHours: 11.0,
    declinationDegrees: 55.0,
    requiredGear: "naked_eye",
    difficulty: "easy",
    franceFriendly: true,
    priority: 86,
    questTitle: "Trouve la Grande Ourse",
    description: "Une forme très connue et souvent visible depuis la France.",
    observationTip: "Cherche une forme de casserole dans le ciel.",
  },
  {
    id: "cassiopeia",
    name: "Cassiopeia",
    frenchName: "Cassiopée",
    type: "constellation",
    rightAscensionHours: 1.0,
    declinationDegrees: 60.0,
    requiredGear: "naked_eye",
    difficulty: "medium",
    franceFriendly: true,
    priority: 80,
    questTitle: "Trouve Cassiopée",
    description: "Une constellation simple à reconnaître quand elle est assez haute.",
    observationTip: "Cherche une forme de W ou de M dans le ciel.",
  },
  {
    id: "summer-triangle",
    name: "Summer Triangle",
    frenchName: "Triangle d'été",
    type: "asterism",
    rightAscensionHours: 19.7,
    declinationDegrees: 34.0,
    requiredGear: "naked_eye",
    difficulty: "easy",
    franceFriendly: true,
    seasonHint: "printemps-été-automne",
    priority: 94,
    questTitle: "Repère le Triangle d'été",
    description: "Trois étoiles brillantes, très bon objectif des soirées de printemps à automne.",
    observationTip: "Cherche trois étoiles brillantes formant un grand triangle.",
  },
  {
    id: "vega",
    name: "Vega",
    frenchName: "Véga",
    type: "star",
    rightAscensionHours: 18.6156,
    declinationDegrees: 38.7837,
    requiredGear: "naked_eye",
    difficulty: "easy",
    franceFriendly: true,
    seasonHint: "été",
    priority: 84,
    questTitle: "Trouve Véga",
    description: "Une étoile très brillante, souvent haute dans le ciel en été.",
    observationTip: "Cherche une étoile très brillante, souvent visible haut dans le ciel en été.",
  },
  {
    id: "arcturus",
    name: "Arcturus",
    frenchName: "Arcturus",
    type: "star",
    rightAscensionHours: 14.261,
    declinationDegrees: 19.1825,
    requiredGear: "naked_eye",
    difficulty: "easy",
    franceFriendly: true,
    seasonHint: "printemps-été",
    priority: 84,
    questTitle: "Trouve Arcturus",
    description: "Une étoile brillante légèrement orangée, intéressante au printemps et en été.",
    observationTip: "Cherche une étoile brillante légèrement orangée.",
  },
  {
    id: "antares",
    name: "Antares",
    frenchName: "Antarès",
    type: "star",
    rightAscensionHours: 16.4901,
    declinationDegrees: -26.432,
    requiredGear: "naked_eye",
    difficulty: "medium",
    franceFriendly: true,
    seasonHint: "été",
    priority: 62,
    questTitle: "Tente Antarès",
    description:
      "Visible depuis la France seulement assez bas vers le Sud quand l'horizon est dégagé.",
    observationTip: "Regarde bas vers le Sud. Cherche une étoile rouge-orangée.",
  },
  {
    id: "pleiades",
    name: "M45",
    frenchName: "Pléiades",
    type: "star_cluster",
    rightAscensionHours: 3.79,
    declinationDegrees: 24.1167,
    requiredGear: "naked_eye",
    difficulty: "easy",
    franceFriendly: true,
    seasonHint: "automne-hiver",
    priority: 78,
    questTitle: "Trouve les Pléiades",
    description: "Un petit groupe d'étoiles serrées, surtout intéressant en automne et hiver.",
    observationTip: "Cherche un petit groupe d'étoiles serrées, comme une mini-casserole.",
  },
  {
    id: "andromeda",
    name: "M31",
    frenchName: "Galaxie d'Andromède",
    type: "galaxy",
    rightAscensionHours: 0.7123,
    declinationDegrees: 41.2692,
    requiredGear: "binoculars_recommended",
    difficulty: "hard",
    franceFriendly: true,
    seasonHint: "automne",
    priority: 55,
    questTitle: "Tente la galaxie d'Andromède",
    description: "Une cible difficile à l'oeil nu : meilleure loin des lumières ou avec jumelles.",
    observationTip:
      "Ne cherche pas une image comme sur les photos : Andromède ressemble plutôt à une faible tache floue.",
    warning: "Ciel sombre conseillé, jumelles utiles.",
  },
];
