export function isSecureBrowserContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export type GeoPosition = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
};

export function getInsecureContextMessage(feature: "position" | "camera" | "orientation"): string {
  const label =
    feature === "position" ? "la position" : feature === "camera" ? "la caméra" : "l'orientation";
  return `${label[0].toUpperCase()}${label.slice(1)} nécessite une connexion HTTPS. Tu peux continuer sans cette fonction et réessayer plus tard.`;
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
          ...(typeof position.coords.altitude === "number" &&
          Number.isFinite(position.coords.altitude)
            ? { altitudeMeters: position.coords.altitude }
            : {}),
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error("Position refusée. Tu pourras la réautoriser plus tard dans ton navigateur."),
          );
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(
            new Error(
              "La position a mis trop de temps à répondre. Tu pourras réessayer plus tard.",
            ),
          );
          return;
        }

        reject(new Error("Position indisponible sur cet appareil pour le moment."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2 * 60 * 1000 },
    );
  });
}
