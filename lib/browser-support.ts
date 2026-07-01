export function isSecureBrowserContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export type GeoPosition = {
  latitude: number;
  longitude: number;
};

export function getInsecureContextMessage(feature: "position" | "camera" | "orientation"): string {
  const label = feature === "position" ? "la position" : feature === "camera" ? "la caméra" : "l'orientation";
  return `Safari bloque ${label} si l'app n'est pas ouverte en HTTPS. Utilise une URL https, un tunnel HTTPS ou un déploiement.`;
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!isSecureBrowserContext()) {
      reject(new Error(getInsecureContextMessage("position")));
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("La géolocalisation n'est pas disponible sur ce navigateur."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("Position refusée. Vérifie Réglages > Safari > Position, puis réessaie."));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error("Position trop longue à obtenir. Essaie dehors, avec le GPS activé."));
          return;
        }

        reject(new Error("Position indisponible sur cet appareil pour le moment."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2 * 60 * 1000 },
    );
  });
}
