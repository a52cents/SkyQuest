import { deleteStoredPhoto, getStoredPhoto, saveStoredPhoto } from "./local-database.ts";

export function photoDataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Data URL photo invalide.");

  const mimeType = match[1] || "application/octet-stream";
  let binary: string;
  try {
    binary = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  } catch {
    throw new Error("Photo encodee invalide.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export const savePhoto = saveStoredPhoto;
export const getPhoto = getStoredPhoto;
export const deletePhoto = deleteStoredPhoto;

export function savePhotoFromDataUrl(dataUrl: string, requestedId?: string): Promise<string> {
  return savePhoto(photoDataUrlToBlob(dataUrl), requestedId);
}

export async function getPhotoObjectUrl(photoId: string): Promise<string | null> {
  const blob = await getPhoto(photoId);
  return blob ? URL.createObjectURL(blob) : null;
}

export function revokePhotoObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
