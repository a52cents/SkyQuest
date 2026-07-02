export type GlossaryCategory =
  "objects" | "sky_position" | "observation" | "phenomena" | "equipment";

export type GlossaryTerm = {
  id: string;
  term: string;
  shortDefinition: string;
  longDefinition?: string;
  category: GlossaryCategory;
  examples?: string[];
};

export const glossaryCategoryLabels: Record<GlossaryCategory, string> = {
  objects: "Objets",
  sky_position: "Position dans le ciel",
  observation: "Observation",
  phenomena: "Phénomènes",
  equipment: "Matériel",
};

export const glossaryCategories = Object.keys(glossaryCategoryLabels) as GlossaryCategory[];

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "astre",
    term: "Astre",
    category: "objects",
    shortDefinition:
      "Objet naturel présent dans le ciel, comme une étoile, une planète ou la Lune.",
  },
  {
    id: "etoile",
    term: "Étoile",
    category: "objects",
    shortDefinition:
      "Immense boule de gaz très chaude qui produit sa propre lumière. Le Soleil est une étoile.",
  },
  {
    id: "planete",
    term: "Planète",
    category: "objects",
    shortDefinition:
      "Corps qui tourne autour d’une étoile et réfléchit sa lumière, comme Mars autour du Soleil.",
  },
  {
    id: "constellation",
    term: "Constellation",
    category: "objects",
    shortDefinition:
      "Zone officielle du ciel portant un nom, souvent associée à une figure imaginaire.",
    examples: ["Orion et la Grande Ourse sont des constellations."],
  },
  {
    id: "asterisme",
    term: "Astérisme",
    category: "objects",
    shortDefinition:
      "Motif facile à reconnaître formé par des étoiles, sans être forcément une constellation entière.",
    examples: ["La Grande Casserole est un astérisme de la Grande Ourse."],
  },
  {
    id: "amas-etoiles",
    term: "Amas d’étoiles",
    category: "objects",
    shortDefinition:
      "Groupe d’étoiles proches les unes des autres, souvent nées dans la même région.",
    examples: ["Les Pléiades forment un amas visible à l’œil nu."],
  },
  {
    id: "nebuleuse",
    term: "Nébuleuse",
    category: "objects",
    shortDefinition:
      "Grand nuage de gaz et de poussières dans l’espace, parfois éclairé par des étoiles.",
  },
  {
    id: "galaxie",
    term: "Galaxie",
    category: "objects",
    shortDefinition:
      "Immense ensemble d’étoiles, de gaz et de poussières. Nous vivons dans la Voie lactée.",
  },
  {
    id: "ciel-profond",
    term: "Ciel profond",
    category: "objects",
    shortDefinition:
      "Objets situés loin du Système solaire, comme les galaxies, nébuleuses et amas d’étoiles.",
  },
  {
    id: "horizon",
    term: "Horizon",
    category: "sky_position",
    shortDefinition: "Ligne apparente où le ciel rejoint le sol ou le paysage autour de toi.",
  },
  {
    id: "zenith",
    term: "Zénith",
    category: "sky_position",
    shortDefinition: "Point du ciel situé exactement au-dessus de ta tête.",
  },
  {
    id: "azimut",
    term: "Azimut",
    category: "sky_position",
    shortDefinition:
      "Direction d’un objet autour de toi : nord, est, sud, ouest et les directions intermédiaires.",
    longDefinition:
      "SkyQuest traduit généralement l’azimut en direction simple. Sur l’échelle en degrés, le nord vaut 0°, l’est 90°, le sud 180° et l’ouest 270°.",
  },
  {
    id: "altitude",
    term: "Altitude",
    category: "sky_position",
    shortDefinition:
      "Hauteur d’un objet dans le ciel, mesurée depuis l’horizon jusqu’au-dessus de ta tête.",
    longDefinition:
      "Un objet à 0° est sur l’horizon. À 90°, il est au zénith. Cette altitude est un angle, pas une distance en mètres.",
  },
  {
    id: "ecliptique",
    term: "Écliptique",
    category: "sky_position",
    shortDefinition:
      "Chemin apparent suivi par le Soleil dans le ciel au fil de l’année, près duquel passent aussi les planètes.",
  },
  {
    id: "magnitude",
    term: "Magnitude",
    category: "observation",
    shortDefinition:
      "Mesure de l’éclat apparent d’un astre : plus le nombre est petit, plus l’objet paraît brillant.",
  },
  {
    id: "pollution-lumineuse",
    term: "Pollution lumineuse",
    category: "observation",
    shortDefinition:
      "Lumière artificielle qui éclaircit le ciel nocturne et masque les objets les moins brillants.",
  },
  {
    id: "oeil-nu",
    term: "Objet visible à l’œil nu",
    category: "observation",
    shortDefinition:
      "Objet que l’on peut tenter de voir sans jumelles ni télescope lorsque les conditions sont favorables.",
  },
  {
    id: "phase-lunaire",
    term: "Phase lunaire",
    category: "phenomena",
    shortDefinition:
      "Partie éclairée de la Lune visible depuis la Terre, du fin croissant à la pleine Lune.",
  },
  {
    id: "conjonction",
    term: "Conjonction",
    category: "phenomena",
    shortDefinition: "Moment où deux astres semblent très proches l’un de l’autre dans le ciel.",
  },
  {
    id: "opposition",
    term: "Opposition",
    category: "phenomena",
    shortDefinition:
      "Moment où une planète se trouve à l’opposé du Soleil dans notre ciel et est souvent bien placée pour l’observation.",
  },
  {
    id: "transit",
    term: "Transit",
    category: "phenomena",
    shortDefinition: "Passage apparent d’un objet devant un autre, comme Mercure devant le Soleil.",
  },
  {
    id: "meteore",
    term: "Météore",
    category: "phenomena",
    shortDefinition:
      "Trace lumineuse produite lorsqu’un petit fragment venu de l’espace traverse notre atmosphère.",
  },
  {
    id: "etoile-filante",
    term: "Étoile filante",
    category: "phenomena",
    shortDefinition: "Nom courant d’un météore. Malgré son nom, ce n’est pas une étoile.",
  },
  {
    id: "jumelles",
    term: "Jumelles",
    category: "equipment",
    shortDefinition:
      "Instrument à deux oculaires qui grossit le ciel tout en gardant un champ de vision assez large.",
  },
  {
    id: "telescope",
    term: "Télescope",
    category: "equipment",
    shortDefinition:
      "Instrument qui recueille davantage de lumière pour révéler des objets plus faibles ou plus détaillés.",
  },
];

const glossaryById = new Map(glossaryTerms.map((item) => [item.id, item]));

export function getGlossaryTerm(termId: string): GlossaryTerm | undefined {
  return glossaryById.get(termId);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

export function filterGlossaryTerms(
  query: string,
  category: GlossaryCategory | "all" = "all",
): GlossaryTerm[] {
  const normalizedQuery = normalizeSearchText(query);

  return glossaryTerms.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!normalizedQuery) return true;

    const searchableText = [
      item.term,
      item.shortDefinition,
      item.longDefinition,
      ...(item.examples ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    return normalizeSearchText(searchableText).includes(normalizedQuery);
  });
}
