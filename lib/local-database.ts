import type { Observation } from "@/lib/types";

const DATABASE_NAME = "skyquest.photos.v1";
const DATABASE_VERSION = 2;
const PHOTO_STORE_NAME = "photos";
const OBSERVATION_STORE_NAME = "observations";

type StoredPhoto = {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
};

export type ObservationPageOptions = {
  before?: { createdAt: string; id: string };
  limit: number;
};

function openDatabase(): Promise<IDBDatabase> {
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
      if (!database.objectStoreNames.contains(OBSERVATION_STORE_NAME)) {
        const store = database.createObjectStore(OBSERVATION_STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", ["createdAt", "id"], { unique: false });
        store.createIndex("target", "target", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("targetType", "targetType", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir IndexedDB."));
    request.onblocked = () => reject(new Error("La base locale est bloquee."));
  });
}

async function withDatabase<T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

function waitForTransaction(transaction: IDBTransaction, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error(message));
    transaction.onabort = () => reject(transaction.error ?? new Error(message));
  });
}

export function addStoredObservation(observation: Observation): Promise<void> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(OBSERVATION_STORE_NAME, "readwrite");
    transaction.objectStore(OBSERVATION_STORE_NAME).add(observation);
    await waitForTransaction(transaction, "Impossible d'enregistrer l'observation.");
  });
}

export function importStoredObservations(observations: Observation[]): Promise<void> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(OBSERVATION_STORE_NAME, "readwrite");
    const store = transaction.objectStore(OBSERVATION_STORE_NAME);
    observations.forEach((observation) => store.put(observation));
    await waitForTransaction(transaction, "Impossible de migrer les observations.");
  });
}

export function getObservation(id: string): Promise<Observation | null> {
  return withDatabase(
    (database) =>
      new Promise((resolve, reject) => {
        const request = database
          .transaction(OBSERVATION_STORE_NAME, "readonly")
          .objectStore(OBSERVATION_STORE_NAME)
          .get(id);
        request.onsuccess = () => resolve((request.result as Observation | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("Observation illisible."));
      }),
  );
}

export function getObservationPage({
  before,
  limit,
}: ObservationPageOptions): Promise<Observation[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  return withDatabase(
    (database) =>
      new Promise((resolve, reject) => {
        const observations: Observation[] = [];
        const index = database
          .transaction(OBSERVATION_STORE_NAME, "readonly")
          .objectStore(OBSERVATION_STORE_NAME)
          .index("createdAt");
        const range = before
          ? IDBKeyRange.upperBound([before.createdAt, before.id], true)
          : undefined;
        const request = index.openCursor(range, "prev");
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || observations.length >= safeLimit) {
            resolve(observations);
            return;
          }
          observations.push(cursor.value as Observation);
          cursor.continue();
        };
        request.onerror = () => reject(request.error ?? new Error("Journal illisible."));
      }),
  );
}

export function getRecentObservations(limit: number): Promise<Observation[]> {
  return getObservationPage({ limit });
}

export function countObservations(): Promise<number> {
  return withDatabase(
    (database) =>
      new Promise((resolve, reject) => {
        const request = database
          .transaction(OBSERVATION_STORE_NAME, "readonly")
          .objectStore(OBSERVATION_STORE_NAME)
          .count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Comptage impossible."));
      }),
  );
}

export function updateStoredObservation(observation: Observation): Promise<void> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(OBSERVATION_STORE_NAME, "readwrite");
    transaction.objectStore(OBSERVATION_STORE_NAME).put(observation);
    await waitForTransaction(transaction, "Mise a jour impossible.");
  });
}

export function clearStoredObservations(): Promise<void> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(OBSERVATION_STORE_NAME, "readwrite");
    transaction.objectStore(OBSERVATION_STORE_NAME).clear();
    await waitForTransaction(transaction, "Suppression du journal impossible.");
  });
}

function createPhotoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function saveStoredPhoto(blob: Blob, requestedId?: string): Promise<string> {
  return withDatabase(async (database) => {
    const id = requestedId || createPhotoId();
    const photo: StoredPhoto = {
      id,
      blob,
      mimeType: blob.type || "application/octet-stream",
      createdAt: new Date().toISOString(),
    };
    const transaction = database.transaction(PHOTO_STORE_NAME, "readwrite");
    transaction.objectStore(PHOTO_STORE_NAME).put(photo);
    await waitForTransaction(transaction, "Impossible d'enregistrer la photo.");
    return id;
  });
}

export function getStoredPhoto(photoId: string): Promise<Blob | null> {
  return withDatabase(
    (database) =>
      new Promise((resolve, reject) => {
        const request = database
          .transaction(PHOTO_STORE_NAME, "readonly")
          .objectStore(PHOTO_STORE_NAME)
          .get(photoId);
        request.onsuccess = () => {
          const photo = request.result as StoredPhoto | undefined;
          resolve(photo?.blob instanceof Blob ? photo.blob : null);
        };
        request.onerror = () => reject(request.error ?? new Error("Impossible de lire la photo."));
      }),
  );
}

export function deleteStoredPhoto(photoId: string): Promise<void> {
  return withDatabase(async (database) => {
    const transaction = database.transaction(PHOTO_STORE_NAME, "readwrite");
    transaction.objectStore(PHOTO_STORE_NAME).delete(photoId);
    await waitForTransaction(transaction, "Suppression de la photo impossible.");
  });
}
