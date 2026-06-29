export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function angleDifference(current: number, target: number): number {
  return ((normalizeAngle(target) - normalizeAngle(current) + 540) % 360) - 180;
}

export function azimuthToCardinal(azimuth: number): string {
  const directions = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ouest", "Ouest", "Nord-Ouest"];
  const index = Math.round(normalizeAngle(azimuth) / 45) % directions.length;
  return directions[index];
}

export function betaToCameraAltitude(beta: number): number {
  return Math.max(-90, Math.min(90, beta - 90));
}

export function getDirectionHint(currentAzimuth: number, targetAzimuth: number): string {
  const diff = angleDifference(currentAzimuth, targetAzimuth);

  if (diff > 15) {
    return "Tourne à droite";
  }

  if (diff < -15) {
    return "Tourne à gauche";
  }

  return "Bonne direction";
}

export function getAltitudeHint(currentPitch: number, targetAltitude: number): string {
  const diff = targetAltitude - currentPitch;

  if (diff > 10) {
    return "Lève un peu le téléphone";
  }

  if (diff < -10) {
    return "Baisse un peu le téléphone";
  }

  return "Hauteur proche";
}
