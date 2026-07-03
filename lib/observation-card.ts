import { getPhoto } from "@/lib/photo-db";
import type { Observation } from "@/lib/types";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const MEMORY_BADGE_LABELS: Record<string, string> = {
  "first-planet": "Première planète",
  "first-constellation": "Première constellation",
  "moon-hunter": "Chasseur de Lune",
};

export function getObservationBadgeLabels(observation: Observation): string[] {
  const achievementBadges = (observation.unlockedAchievements ?? [])
    .map((id) => MEMORY_BADGE_LABELS[id])
    .filter((label): label is string => Boolean(label));
  if (achievementBadges.length > 0) return achievementBadges;
  return observation.isFirstDiscovery ? ["Nouvelle découverte"] : ["Observation confirmée"];
}

export function getObservationTargetLabel(observation: Observation): string {
  if (/^[A-ZÀ-ÖØ-Þ]/.test(observation.target) || observation.target.toLowerCase() === "iss") {
    return observation.target.toLowerCase() === "iss" ? "ISS" : observation.target;
  }

  return observation.questTitle
    .replace(/^(repère|trouve|observe|cherche)\s+/i, "")
    .replace(/^une?\s+/i, "");
}

export function getWeatherLabel(observation: Observation): string {
  const cloudCover = observation.weather?.cloudCover;
  if (typeof cloudCover !== "number") return "Conditions estimées";
  if (cloudCover <= 15) return "Ciel clair";
  if (cloudCover <= 40) return "Peu nuageux";
  if (cloudCover <= 70) return "Nuageux";
  return "Très nuageux";
}

export function getSeasonLabel(date: Date): string {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return "Hiver";
  if (month <= 4) return "Printemps";
  if (month <= 7) return "Été";
  return "Automne";
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

async function blobToImage(
  blob: Blob,
): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);

  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Photo illisible."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
) {
  const scale = Math.max(CARD_WIDTH / image.width, CARD_HEIGHT / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (CARD_WIDTH - width) / 2, (CARD_HEIGHT - height) / 2, width, height);
}

function drawPill(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: { accent?: boolean } = {},
): number {
  context.font = "600 30px Arial, sans-serif";
  const width = Math.ceil(context.measureText(text).width) + 52;
  roundedRect(context, x, y, width, 58, 29);
  context.fillStyle = options.accent ? "rgba(124,92,255,0.88)" : "rgba(9,9,15,0.66)";
  context.fill();
  context.strokeStyle = options.accent ? "rgba(210,203,255,0.55)" : "rgba(255,255,255,0.2)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#f8f8ff";
  context.fillText(text, x + 26, y + 39);
  return width;
}

export async function createObservationCardBlob(observation: Observation): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Création de la carte indisponible.");

  const background = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  background.addColorStop(0, "#171332");
  background.addColorStop(0.48, "#0b1530");
  background.addColorStop(1, "#09090d");
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const photoId = observation.photoId ?? observation.photoThumbnailId;
  if (photoId) {
    const photo = await getPhoto(photoId).catch(() => null);
    if (photo) {
      const image = await blobToImage(photo);
      drawCoverImage(context, image);
      if ("close" in image && typeof image.close === "function") image.close();
    }
  } else {
    context.fillStyle = "rgba(255,255,255,0.42)";
    for (let index = 0; index < 74; index += 1) {
      const x = (index * 193) % CARD_WIDTH;
      const y = (index * index * 47) % 880;
      const radius = index % 9 === 0 ? 3 : 1.5;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  const shade = context.createLinearGradient(0, 220, 0, CARD_HEIGHT);
  shade.addColorStop(0, "rgba(4,5,13,0.04)");
  shade.addColorStop(0.48, "rgba(4,5,13,0.18)");
  shade.addColorStop(0.72, "rgba(7,7,13,0.82)");
  shade.addColorStop(1, "rgba(7,7,11,0.98)");
  context.fillStyle = shade;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  context.fillStyle = "rgba(9,9,15,0.68)";
  roundedRect(context, 64, 62, 268, 74, 37);
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.2)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = "700 34px Arial, sans-serif";
  context.fillText("✦  SKYQUEST", 94, 111);
  drawPill(context, getObservationBadgeLabels(observation)[0], 64, 158, { accent: true });

  const date = new Date(observation.createdAt);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
    date,
  );
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const target = getObservationTargetLabel(observation);

  context.fillStyle = "#a9a5ff";
  context.font = "700 30px Arial, sans-serif";
  context.fillText("J’AI REPÉRÉ", 72, 875);
  context.fillStyle = "#ffffff";
  context.font = "64px Georgia, serif";
  context.fillText(target.slice(0, 25), 72, 952);
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "32px Arial, sans-serif";
  context.fillText(`${dateLabel}  ·  ${time}`, 72, 1008);

  let pillX = 72;
  const weatherWidth = drawPill(context, getWeatherLabel(observation), pillX, 1050);
  pillX += weatherWidth + 16;
  drawPill(context, `${Math.round(observation.visibilityScore)}% visibilité`, pillX, 1050, {
    accent: true,
  });

  context.strokeStyle = "rgba(255,255,255,0.14)";
  context.beginPath();
  context.moveTo(72, 1150);
  context.lineTo(CARD_WIDTH - 72, 1150);
  context.stroke();

  context.fillStyle = "#ffffff";
  context.font = "700 31px Arial, sans-serif";
  const xpLabel = observation.xpEarned
    ? `+${observation.xpEarned} · ${observation.totalXp ?? 0} Éclats d’étoile`
    : `${observation.totalXp ?? 0} Éclats d’étoile`;
  context.fillText(xpLabel, 72, 1215);
  context.fillText(
    `${observation.streak ?? 0} nuit${observation.streak === 1 ? "" : "s"}`,
    430,
    1215,
  );
  context.textAlign = "right";
  context.fillStyle = "#bdb7ff";
  context.fillText(observation.rankName ?? "Curieux du ciel", CARD_WIDTH - 72, 1215);
  context.textAlign = "left";
  context.fillStyle = "rgba(255,255,255,0.5)";
  context.font = "25px Arial, sans-serif";
  context.fillText("Une observation locale · aucune photo envoyée", 72, 1286);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export de la carte impossible."))),
      "image/png",
    );
  });
}
