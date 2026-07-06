import { getPhoto } from "./photo-db.ts";
import type { AchievementId, Observation, QuestTargetType } from "./types.ts";

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

const RARE_TARGET_TYPES = new Set<QuestTargetType>(["galaxy", "meteor_shower", "satellite"]);
const RARE_ACHIEVEMENTS = new Set<AchievementId>([
  "moon-hunter",
  "planet-tour",
  "night-landmarks",
  "orbital-watcher",
  "explorer",
  "confirmed-watcher",
]);

export type ObservationCardRarity = "standard" | "discovery" | "rare";

export function getObservationCardRarity(observation: Observation): ObservationCardRarity {
  if (
    (observation.targetType && RARE_TARGET_TYPES.has(observation.targetType)) ||
    (observation.unlockedAchievements ?? []).some((id) => RARE_ACHIEVEMENTS.has(id))
  ) {
    return "rare";
  }
  return observation.isFirstDiscovery ? "discovery" : "standard";
}

export function getObservationTargetLabel(observation: Observation): string {
  if (
    observation.targetType === "free_observation" ||
    observation.target.toLowerCase() === "freeobservation"
  ) {
    return "Observation libre";
  }

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

function drawFallbackSky(context: CanvasRenderingContext2D) {
  const space = context.createRadialGradient(760, 220, 40, 540, 520, 980);
  space.addColorStop(0, "#26326b");
  space.addColorStop(0.42, "#121a3a");
  space.addColorStop(1, "#07080f");
  context.fillStyle = space;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  for (let index = 0; index < 88; index += 1) {
    const x = (index * 193) % CARD_WIDTH;
    const y = (index * index * 47) % 920;
    const radius = index % 13 === 0 ? 3.2 : index % 5 === 0 ? 2 : 1.1;
    context.globalAlpha = index % 4 === 0 ? 0.8 : 0.42;
    context.fillStyle = index % 7 === 0 ? "#b9dfff" : "#ffffff";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawBrandMark(context: CanvasRenderingContext2D, centerX: number, centerY: number) {
  const gradient = context.createLinearGradient(
    centerX - 30,
    centerY - 30,
    centerX + 30,
    centerY + 30,
  );
  gradient.addColorStop(0, "#52dcff");
  gradient.addColorStop(0.55, "#ffffff");
  gradient.addColorStop(1, "#9b6cff");

  context.save();
  context.shadowColor = "rgba(106, 113, 255, 0.75)";
  context.shadowBlur = 22;
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(centerX, centerY - 31);
  context.lineTo(centerX + 8, centerY - 8);
  context.lineTo(centerX + 31, centerY);
  context.lineTo(centerX + 8, centerY + 8);
  context.lineTo(centerX, centerY + 31);
  context.lineTo(centerX - 8, centerY + 8);
  context.lineTo(centerX - 31, centerY);
  context.lineTo(centerX - 8, centerY - 8);
  context.closePath();
  context.fill();
  context.restore();

  context.strokeStyle = "rgba(205, 221, 255, 0.55)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(centerX, centerY, 43, 0.18 * Math.PI, 1.15 * Math.PI);
  context.stroke();
}

function drawHolographicFoil(context: CanvasRenderingContext2D) {
  context.save();
  roundedRect(context, 24, 24, CARD_WIDTH - 48, CARD_HEIGHT - 48, 48);
  context.clip();
  context.globalCompositeOperation = "screen";

  const foil = context.createLinearGradient(-160, 120, CARD_WIDTH + 180, CARD_HEIGHT - 80);
  foil.addColorStop(0, "rgba(54, 221, 255, 0)");
  foil.addColorStop(0.18, "rgba(54, 221, 255, 0.20)");
  foil.addColorStop(0.36, "rgba(157, 105, 255, 0.05)");
  foil.addColorStop(0.52, "rgba(255, 94, 205, 0.18)");
  foil.addColorStop(0.68, "rgba(255, 218, 110, 0.08)");
  foil.addColorStop(0.84, "rgba(104, 255, 189, 0.18)");
  foil.addColorStop(1, "rgba(104, 255, 189, 0)");
  context.fillStyle = foil;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  for (let index = 0; index < 5; index += 1) {
    context.save();
    context.translate(-190 + index * 270, -100);
    context.rotate(-0.38);
    const beam = context.createLinearGradient(0, 0, 120, 0);
    beam.addColorStop(0, "rgba(255,255,255,0)");
    beam.addColorStop(0.5, "rgba(210,238,255,0.12)");
    beam.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = beam;
    context.fillRect(0, 0, 120, 1700);
    context.restore();
  }

  context.fillStyle = "rgba(255,255,255,0.68)";
  for (let index = 0; index < 16; index += 1) {
    const x = 92 + ((index * 269) % 900);
    const y = 108 + ((index * index * 83) % 1030);
    const radius = index % 4 === 0 ? 3 : 1.5;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawCardFrame(context: CanvasRenderingContext2D, rarity: ObservationCardRarity) {
  const frame = context.createLinearGradient(24, 24, CARD_WIDTH - 24, CARD_HEIGHT - 24);
  if (rarity === "rare") {
    frame.addColorStop(0, "rgba(76, 222, 255, 0.85)");
    frame.addColorStop(0.34, "rgba(171, 119, 255, 0.68)");
    frame.addColorStop(0.66, "rgba(255, 126, 214, 0.72)");
    frame.addColorStop(1, "rgba(128, 255, 201, 0.75)");
  } else {
    frame.addColorStop(0, "rgba(255,255,255,0.42)");
    frame.addColorStop(1, "rgba(255,255,255,0.10)");
  }
  roundedRect(context, 24, 24, CARD_WIDTH - 48, CARD_HEIGHT - 48, 48);
  context.strokeStyle = frame;
  context.lineWidth = rarity === "rare" ? 5 : 3;
  context.stroke();
}

function fitTitleFont(context: CanvasRenderingContext2D, text: string, maxWidth: number): number {
  let size = 88;
  while (size > 50) {
    context.font = `${size}px Georgia, serif`;
    if (context.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

function getCardKicker(observation: Observation, rarity: ObservationCardRarity): string {
  if (rarity === "rare") return "DÉCOUVERTE RARE";
  if (observation.isFirstDiscovery) return "PREMIÈRE DÉCOUVERTE";
  return "SOUVENIR D’OBSERVATION";
}

export async function createObservationCardBlob(observation: Observation): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Création de la carte indisponible.");

  context.fillStyle = "#07080f";
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const photoId = observation.photoId ?? observation.photoThumbnailId;
  const photo = photoId ? await getPhoto(photoId).catch(() => null) : null;
  if (photo) {
    const image = await blobToImage(photo);
    drawCoverImage(context, image);
    if ("close" in image && typeof image.close === "function") image.close();
  } else {
    drawFallbackSky(context);
  }

  const shade = context.createLinearGradient(0, 260, 0, CARD_HEIGHT);
  shade.addColorStop(0, "rgba(5,7,16,0.06)");
  shade.addColorStop(0.5, "rgba(5,7,16,0.12)");
  shade.addColorStop(0.73, "rgba(5,7,16,0.62)");
  shade.addColorStop(1, "rgba(5,7,13,0.96)");
  context.fillStyle = shade;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const rarity = getObservationCardRarity(observation);
  // if (rarity === "rare") drawHolographicFoil(context);
  drawCardFrame(context, rarity);
  drawBrandMark(context, 82, 82);

  const date = new Date(observation.createdAt);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const target = getObservationTargetLabel(observation);

  context.shadowColor = "rgba(0,0,0,0.75)";
  context.shadowBlur = 18;
  context.fillStyle = rarity === "rare" ? "#bff5ff" : "#b8b3ff";
  context.font = "700 27px Arial, sans-serif";
  context.fillText(getCardKicker(observation, rarity), 68, 1090);

  context.fillStyle = "#ffffff";
  const titleSize = fitTitleFont(context, target, CARD_WIDTH - 136);
  context.font = `${titleSize}px Georgia, serif`;
  context.fillText(target, 68, 1184);

  context.fillStyle = "rgba(255,255,255,0.68)";
  context.font = "30px Arial, sans-serif";
  context.fillText(dateLabel, 68, 1250);
  context.shadowBlur = 0;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export de la carte impossible."))),
      "image/png",
    );
  });
}
