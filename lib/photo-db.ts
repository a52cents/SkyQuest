const DATABASE_NAME = "skyquest.photos.v1";
const DATABASE_VERSION = 1;
const PHOTO_STORE_NAME = "photos";

type StoredPhoto = {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
};

function openPhotoDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB est indisponible."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PHOTO_STORE_NAME)) {
        database.createObjectStore(PHOTO_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir IndexedDB."));
    request.onblocked = () => reject(new Error("La base de photos est bloquee."));
  });
}

function createPhotoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Data URL photo invalide.");
  }

  const mimeType = match[1] || "application/octet-stream";
  const encodedData = match[3];
  let binary: string;
  try {
    binary = match[2] ? atob(encodedData) : decodeURIComponent(encodedData);
  } catch {
    throw new Error("Photo encodee invalide.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function savePhoto(blob: Blob): Promise<string> {
  const database = await openPhotoDatabase();
  const id = createPhotoId();
  const photo: StoredPhoto = {
    id,
    blob,
    mimeType: blob.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE_NAME, "readwrite");
      transaction.objectStore(PHOTO_STORE_NAME).put(photo);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Impossible d'enregistrer la photo."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Enregistrement de la photo annule."));
    });
    return id;
  } finally {
    database.close();
  }
}

export async function getPhoto(photoId: string): Promise<Blob | null> {
  const database = await openPhotoDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(PHOTO_STORE_NAME, "readonly")
        .objectStore(PHOTO_STORE_NAME)
        .get(photoId);
      request.onsuccess = () => {
        const photo = request.result as StoredPhoto | undefined;
        resolve(photo?.blob instanceof Blob ? photo.blob : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Impossible de lire la photo."));
    });
  } finally {
    database.close();
  }
}

export async function deletePhoto(photoId: string): Promise<void> {
  const database = await openPhotoDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PHOTO_STORE_NAME, "readwrite");
      transaction.objectStore(PHOTO_STORE_NAME).delete(photoId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Impossible de supprimer la photo."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Suppression de la photo annulee."));
    });
  } finally {
    database.close();
  }
}

export function savePhotoFromDataUrl(dataUrl: string): Promise<string> {
  return savePhoto(dataUrlToBlob(dataUrl));
}

export async function getPhotoObjectUrl(photoId: string): Promise<string | null> {
  const blob = await getPhoto(photoId);
  return blob ? URL.createObjectURL(blob) : null;
}

export function revokePhotoObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}
