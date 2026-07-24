const DB_NAME = "bill-uploader";
const STORE_NAME = "share";
const PENDING_KEY = "pending";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function storeSharePayload(payload) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(payload, PENDING_KEY);
  });
  db.close();
}

async function readFileEntry(entry) {
  if (!(entry instanceof File) || entry.size === 0) {
    return null;
  }

  return {
    name: entry.name || "shared-file",
    type: entry.type || "application/octet-stream",
    blob: entry,
  };
}

async function parseShareFormData(formData) {
  const text = String(formData.get("text") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const files = [];

  for (const value of formData.getAll("media")) {
    const file = await readFileEntry(value);
    if (file) {
      files.push(file);
    }
  }

  for (const value of formData.values()) {
    if (value instanceof File && value.size > 0) {
      const alreadyAdded = files.some(
        (file) => file.name === value.name && file.type === value.type && file.blob.size === value.size,
      );
      if (!alreadyAdded) {
        const file = await readFileEntry(value);
        if (file) {
          files.push(file);
        }
      }
    }
  }

  return {
    createdAt: Date.now(),
    text,
    title,
    url,
    files,
  };
}

async function handleShareRequest(request) {
  const formData = await request.formData();
  const payload = await parseShareFormData(formData);
  await storeSharePayload(payload);
  return Response.redirect(new URL("/", self.location.origin), 303);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === "/share" && event.request.method === "POST") {
    event.respondWith(handleShareRequest(event.request));
  }
});
