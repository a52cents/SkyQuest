import type { PhotoDraft } from "./types";

const PHOTO_MAX_WIDTH = 1280;
const THUMBNAIL_MAX_WIDTH = 360;
const PHOTO_QUALITY = 0.75;

async function createResizedDataUrl(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
): Promise<string> {
  const scale = Math.min(1, maxWidth / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible.");
  context.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

export async function createPhotoDraftFromImage(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<PhotoDraft> {
  const photoDataUrl = await createResizedDataUrl(source, width, height, PHOTO_MAX_WIDTH);
  const photoThumbnailDataUrl = await createResizedDataUrl(
    source,
    width,
    height,
    THUMBNAIL_MAX_WIDTH,
  );
  return { photoDataUrl, photoThumbnailDataUrl };
}

export async function createPhotoDraftFromFile(file: File): Promise<PhotoDraft> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image illisible."));
      image.src = url;
    });
    return await createPhotoDraftFromImage(image, image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}
