export function isSecureBrowserContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function getInsecureContextMessage(feature: "position" | "camera" | "orientation"): string {
  const label = feature === "position" ? "la position" : feature === "camera" ? "la caméra" : "l'orientation";
  return `Safari bloque ${label} si l'app n'est pas ouverte en HTTPS. Utilise une URL https, un tunnel HTTPS ou un déploiement.`;
}
