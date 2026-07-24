import { NextResponse } from "next/server";

const DB_NAME = "bill-uploader";
const STORE_NAME = "share";
const PENDING_KEY = "pending";

function shareBridgeHtml(payload: {
  createdAt: number;
  text: string;
  title: string;
  url: string;
  files: Array<{ name: string; type: string; data: string }>;
}) {
  const encoded = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening Bill Uploader…</title>
  </head>
  <body>
    <script>
      (async () => {
        const payload = ${encoded};
        const dbRequest = indexedDB.open(${JSON.stringify(DB_NAME)}, 1);
        dbRequest.onupgradeneeded = () => {
          dbRequest.result.createObjectStore(${JSON.stringify(STORE_NAME)});
        };
        dbRequest.onerror = () => {
          window.location.replace("/");
        };
        dbRequest.onsuccess = async () => {
          const db = dbRequest.result;
          const files = [];
          for (const file of payload.files) {
            const binary = atob(file.data);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
              bytes[index] = binary.charCodeAt(index);
            }
            files.push({
              name: file.name,
              type: file.type,
              blob: new Blob([bytes], { type: file.type }),
            });
          }
          const tx = db.transaction(${JSON.stringify(STORE_NAME)}, "readwrite");
          tx.objectStore(${JSON.stringify(STORE_NAME)}).put(
            {
              createdAt: payload.createdAt,
              text: payload.text,
              title: payload.title,
              url: payload.url,
              files,
            },
            ${JSON.stringify(PENDING_KEY)},
          );
          tx.oncomplete = () => {
            db.close();
            window.location.replace("/");
          };
          tx.onerror = () => {
            db.close();
            window.location.replace("/");
          };
        };
      })();
    </script>
  </body>
</html>`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const text = String(formData.get("text") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const files: Array<{ name: string; type: string; data: string }> = [];

  for (const value of formData.values()) {
    if (!(value instanceof File) || value.size === 0) {
      continue;
    }

    if (value.size > 25 * 1024 * 1024) {
      return NextResponse.redirect(new URL("/?shareError=too-large", request.url), 303);
    }

    const buffer = Buffer.from(await value.arrayBuffer());
    files.push({
      name: value.name || "shared-file",
      type: value.type || "application/octet-stream",
      data: buffer.toString("base64"),
    });
  }

  const html = shareBridgeHtml({
    createdAt: Date.now(),
    text,
    title,
    url,
    files,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}
