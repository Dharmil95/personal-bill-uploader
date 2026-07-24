export type SharedFilePayload = {
  name: string;
  type: string;
  blob: Blob;
};

export type SharePayload = {
  createdAt: number;
  text: string;
  title: string;
  url: string;
  files: SharedFilePayload[];
};

const DB_NAME = "bill-uploader";
const STORE_NAME = "share";
const PENDING_KEY = "pending";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readPending(db: IDBDatabase): Promise<SharePayload | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(PENDING_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as SharePayload | undefined) ?? null);
  });
}

function deletePending(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).delete(PENDING_KEY);
  });
}

export async function consumeSharePayload(): Promise<SharePayload | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  const db = await openDb();
  try {
    const payload = await readPending(db);
    if (!payload) {
      return null;
    }

    await deletePending(db);
    return payload;
  } finally {
    db.close();
  }
}

export function buildSmsTextFromShare(payload: SharePayload): string {
  const parts = [payload.text, payload.title, payload.url].filter(Boolean);
  return parts.join("\n").trim();
}
