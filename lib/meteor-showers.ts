export type MeteorShower = {
  id: string;
  name: string;
  activeStart: string;
  activeEnd: string;
  peakDate: string;
  radiantName: string;
  recommendedViewingTip: string;
};

export const meteorShowers: MeteorShower[] = [
  {
    id: "quadrantids",
    name: "Quadrantides",
    activeStart: "12-28",
    activeEnd: "01-12",
    peakDate: "01-03",
    radiantName: "Bouvier",
    recommendedViewingTip: "Habille-toi chaudement et regarde une zone sombre du ciel pendant 10 à 15 minutes.",
  },
  {
    id: "lyrids",
    name: "Lyrides",
    activeStart: "04-16",
    activeEnd: "04-25",
    peakDate: "04-22",
    radiantName: "Lyre",
    recommendedViewingTip: "Évite les lampadaires et laisse tes yeux s'habituer quelques minutes.",
  },
  {
    id: "perseids",
    name: "Perséides",
    activeStart: "07-17",
    activeEnd: "08-24",
    peakDate: "08-12",
    radiantName: "Persée",
    recommendedViewingTip: "Installe-toi confortablement et regarde large : pas besoin de viser exactement Persée.",
  },
  {
    id: "orionids",
    name: "Orionides",
    activeStart: "10-02",
    activeEnd: "11-07",
    peakDate: "10-21",
    radiantName: "Orion",
    recommendedViewingTip: "Regarde une zone sombre et dégagée, idéalement après que tes yeux se sont adaptés.",
  },
  {
    id: "leonids",
    name: "Léonides",
    activeStart: "11-06",
    activeEnd: "11-30",
    peakDate: "11-17",
    radiantName: "Lion",
    recommendedViewingTip: "Observe sans fixer un point précis : les traces peuvent traverser une grande partie du ciel.",
  },
  {
    id: "geminids",
    name: "Géminides",
    activeStart: "12-04",
    activeEnd: "12-17",
    peakDate: "12-14",
    radiantName: "Gémeaux",
    recommendedViewingTip: "Choisis un endroit sombre, puis observe patiemment une large zone du ciel.",
  },
];

function monthDayToNumber(value: string): number {
  const [month, day] = value.split("-").map(Number);
  return month * 100 + day;
}

export function isMeteorShowerActive(shower: MeteorShower, date: Date): boolean {
  const today = (date.getMonth() + 1) * 100 + date.getDate();
  const start = monthDayToNumber(shower.activeStart);
  const end = monthDayToNumber(shower.activeEnd);

  if (start <= end) {
    return today >= start && today <= end;
  }

  return today >= start || today <= end;
}

export function isNearMeteorShowerPeak(shower: MeteorShower, date: Date): boolean {
  const peak = monthDayToNumber(shower.peakDate);
  const today = (date.getMonth() + 1) * 100 + date.getDate();
  return Math.abs(today - peak) <= 2;
}
