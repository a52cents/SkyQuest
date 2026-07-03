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
  image: {
    src: string;
    alt: string;
    credit: string;
    license: string;
    sourceUrl: string;
  };
  introduction: string;
  howToFind: string;
  whatToExpect: string;
  quickFacts: Array<{ label: string; value: string }>;
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
    image: {
      src: "/catalog/iss.jpg",
      alt: "La Station spatiale internationale photographiée dans l’espace.",
      credit: "NASA",
      license: "Domaine public",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:International_Space_Station.jpg",
    },
    introduction:
      "L’ISS est un laboratoire habité en orbite basse. Depuis le sol, on ne distingue pas sa forme : on voit surtout la lumière du Soleil réfléchie par ses grands panneaux.",
    howToFind:
      "Attends un passage calculé pour ta position, puis regarde dans la direction annoncée quelques minutes avant l’heure. Son mouvement est régulier et elle ne clignote normalement pas comme un avion.",
    whatToExpect:
      "À l’œil nu, un point blanc très lumineux traverse le ciel en quelques minutes. La structure visible sur la photo demande un télescope adapté ou une photographie prise depuis l’espace.",
    quickFacts: [
      { label: "Nature", value: "Station spatiale habitée" },
      { label: "Altitude", value: "Environ 400 km" },
      { label: "Tour de Terre", value: "Environ 90 minutes" },
    ],
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
    image: {
      src: "/catalog/polaris.jpg",
      alt: "Champ d’étoiles tournant autour de l’Étoile Polaire pendant une longue pose.",
      credit: "Heyzeuss",
      license: "CC BY-SA 3.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Polaris_(star).jpg",
    },
    introduction:
      "Polaris se trouve tout près du pôle nord céleste. C’est pour cela qu’elle semble presque immobile pendant que le reste du ciel tourne autour d’elle.",
    howToFind:
      "Repère la casserole de la Grande Ourse. Prolonge environ cinq fois la ligne qui relie les deux étoiles du bord extérieur : elle mène vers Polaris.",
    whatToExpect:
      "Une étoile assez brillante, mais pas la plus brillante du ciel. Les arcs visibles sur la photo viennent d’une longue pose ; tes yeux verront des points fixes.",
    quickFacts: [
      { label: "Constellation", value: "Petite Ourse" },
      { label: "Distance", value: "Environ 430 années-lumière" },
      { label: "Rôle", value: "Repère du nord céleste" },
    ],
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
    image: {
      src: "/catalog/ursa-major.jpg",
      alt: "La Grande Casserole visible dans un véritable ciel nocturne au-dessus des dunes.",
      credit: "Great Sand Dunes National Park and Preserve",
      license: "Domaine public",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Big_Dipper_Constellation_Over_Dunes_(38836718054).jpg",
    },
    introduction:
      "La célèbre casserole est un astérisme de sept étoiles appartenant à la Grande Ourse. Depuis la France, c’est l’un des meilleurs points de départ pour apprendre le ciel.",
    howToFind:
      "Cherche quatre étoiles formant le récipient, puis trois autres dessinant le manche. Les deux étoiles du bord extérieur de la casserole pointent vers l’Étoile Polaire.",
    whatToExpect:
      "Sept étoiles principales bien séparées. Les traits de casserole sont imaginaires : commence par reconnaître les quatre étoiles du récipient.",
    quickFacts: [
      { label: "Nature", value: "Astérisme de 7 étoiles" },
      { label: "Direction", value: "Moitié nord du ciel" },
      { label: "Utilité", value: "Trouver l’Étoile Polaire" },
    ],
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
    image: {
      src: "/catalog/cassiopeia.jpg",
      alt: "Photographie du véritable champ d’étoiles de la constellation de Cassiopée.",
      credit: "A. Fujii / NASA / ESA",
      license: "Domaine public",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Image_of_the_Constellation_Cassiopeia_(ground-based_image)_(opo0613c).jpg",
    },
    introduction:
      "Cassiopée est une constellation circumpolaire facile à mémoriser grâce à ses cinq étoiles principales en W. La Voie lactée traverse cette région riche du ciel.",
    howToFind:
      "Regarde dans la moitié nord du ciel, de l’autre côté de Polaris par rapport à la Grande Ourse. Selon l’heure, la forme ressemble à un W, un M ou un zigzag incliné.",
    whatToExpect:
      "Cinq étoiles forment le repère principal. Une photo révèle beaucoup plus d’étoiles faibles que l’œil nu, surtout depuis une ville.",
    quickFacts: [
      { label: "Nature", value: "Constellation" },
      { label: "Forme", value: "W ou M" },
      { label: "Particularité", value: "Visible une grande partie de l’année" },
    ],
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
    image: {
      src: "/catalog/summer-triangle.jpg",
      alt: "Photographie grand champ du Triangle d’été dans la Voie lactée.",
      credit: "NASA / ESA / A. Fujii",
      license: "Domaine public",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Wide-field_view_of_the_Summer_Triangle.jpg",
    },
    introduction:
      "Le Triangle d’été relie Véga, Deneb et Altaïr. Ce n’est pas une constellation officielle, mais un immense repère qui traverse plusieurs constellations.",
    howToFind:
      "Commence par Véga, très brillante. Cherche ensuite Deneb dans la bande de la Voie lactée et Altaïr, encadrée par deux étoiles plus faibles.",
    whatToExpect:
      "Un très grand triangle, bien plus étendu qu’on ne l’imagine sur une image. La Voie lactée de la photo demande un ciel sombre pour devenir perceptible.",
    quickFacts: [
      { label: "Nature", value: "Astérisme" },
      { label: "Étoiles", value: "Véga, Deneb et Altaïr" },
      { label: "Meilleure période", value: "Été et début d’automne" },
    ],
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
    image: {
      src: "/catalog/vega.jpg",
      alt: "Photographie réelle de la constellation de la Lyre avec Véga très brillante.",
      credit: "E. Slawik / NOIRLab / NSF / AURA / M. Zamani",
      license: "CC BY 4.0",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Photo_of_the_constellation_Lyra_produced_by_NOIRLab_in_collaboration_with_Eckhard_Slawik,_a_German_astrophotographer_(lyra).jpg",
    },
    introduction:
      "Véga est l’étoile la plus brillante de la petite constellation de la Lyre et l’un des trois sommets du Triangle d’été.",
    howToFind:
      "Lors des soirées d’été, cherche l’une des étoiles les plus brillantes presque au-dessus de toi. Les autres étoiles de la Lyre forment un petit parallélogramme à proximité.",
    whatToExpect:
      "Un point blanc légèrement bleuté. Même avec un télescope, une étoile reste généralement un point lumineux plutôt qu’un disque détaillé.",
    quickFacts: [
      { label: "Constellation", value: "Lyre" },
      { label: "Distance", value: "Environ 25 années-lumière" },
      { label: "Couleur", value: "Blanc bleuté" },
    ],
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
    image: {
      src: "/catalog/arcturus.jpg",
      alt: "Photographie de la constellation du Bouvier montrant Arcturus dans un ciel réel.",
      credit: "Till Credner",
      license: "CC BY-SA 3.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:BootesCC.jpg",
    },
    introduction:
      "Arcturus est une géante orange et l’étoile principale du Bouvier. Sa teinte chaude la distingue des étoiles blanches ou bleutées voisines.",
    howToFind:
      "Suis la courbe du manche de la Grande Casserole et prolonge-la : l’arc conduit naturellement jusqu’à Arcturus.",
    whatToExpect:
      "Une étoile très brillante avec une teinte jaune-orangé subtile. La forme du Bouvier autour d’elle est plus difficile à reconnaître.",
    quickFacts: [
      { label: "Constellation", value: "Bouvier" },
      { label: "Distance", value: "Environ 37 années-lumière" },
      { label: "Nature", value: "Géante orange" },
    ],
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
    image: {
      src: "/catalog/antares.jpg",
      alt: "Image astronomique réelle de la région d’Antarès et du complexe de Rho Ophiuchi.",
      credit: "WISE / DSS / Giuseppe Donatiello",
      license: "CC0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Antares_nv_20160818s_(28502429554).jpg",
    },
    introduction:
      "Antarès est une supergéante rouge au cœur du Scorpion. Depuis la France, elle reste basse sur l’horizon sud et demande une vue bien dégagée.",
    howToFind:
      "En été, regarde bas vers le sud. Cherche une étoile orange-rouge au milieu de la courbe du Scorpion, loin sous les étoiles du Triangle d’été.",
    whatToExpect:
      "Un point lumineux nettement chaud quand l’atmosphère est stable. Les nuages colorés de la photo sont révélés par de longues poses et des données infrarouges.",
    quickFacts: [
      { label: "Constellation", value: "Scorpion" },
      { label: "Distance", value: "Environ 550 années-lumière" },
      { label: "Nature", value: "Supergéante rouge" },
    ],
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
    image: {
      src: "/catalog/pleiades.jpg",
      alt: "Astrophotographie réelle de l’amas des Pléiades et de ses nébulosités bleues.",
      credit: "Kees Scherer",
      license: "CC BY-SA 4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Pleiades_Messier_45_(M45).jpg",
    },
    introduction:
      "Les Pléiades, ou M45, sont un jeune amas d’étoiles dans le Taureau. Le groupe est compact et immédiatement reconnaissable quand la saison est favorable.",
    howToFind:
      "En automne et en hiver, cherche un minuscule paquet d’étoiles près du Taureau. À l’œil nu, il ressemble à une toute petite casserole brumeuse.",
    whatToExpect:
      "En général, cinq à sept étoiles à l’œil nu ; davantage avec des jumelles. Les voiles bleus de la photo ne sont pas visibles sans longue pose.",
    quickFacts: [
      { label: "Catalogue", value: "M45" },
      { label: "Distance", value: "Environ 440 années-lumière" },
      { label: "Instrument", value: "Œil nu ou jumelles" },
    ],
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
    image: {
      src: "/catalog/andromeda.jpg",
      alt: "La galaxie d’Andromède observée en infrarouge par le télescope spatial WISE.",
      credit: "NASA / JPL-Caltech / UCLA",
      license: "Domaine public",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:WISE-_Andromeda.jpg",
    },
    introduction:
      "Andromède, ou M31, est la grande galaxie la plus proche de la Voie lactée. Sa lumière voyage pendant environ 2,5 millions d’années avant de nous atteindre.",
    howToFind:
      "Pars du grand carré de Pégase vers la constellation d’Andromède. Sous un ciel sombre, balaie doucement la zone avec des jumelles plutôt que de fixer un seul point.",
    whatToExpect:
      "Une petite tache pâle et allongée, jamais la galaxie colorée et détaillée des photos. L’image présentée utilise l’infrarouge du télescope WISE.",
    quickFacts: [
      { label: "Catalogue", value: "M31" },
      { label: "Distance", value: "Environ 2,5 millions d’années-lumière" },
      { label: "Instrument", value: "Jumelles recommandées" },
    ],
  },
];

export function getCatalogSkyObject(id: string): CatalogSkyObject | undefined {
  return catalogSkyObjects.find((object) => object.id === id);
}
