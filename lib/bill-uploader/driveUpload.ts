import { resolveUploadMimeType } from "@/lib/bill-uploader/utils";
import type { ExpenseOwner } from "@/lib/bill-uploader/types";

type UploadSessionResponse = {
  sessionUri: string;
};

type DriveUploadResult = {
  id: string;
  name?: string;
  webViewLink?: string;
  mimeType?: string;
  createdTime?: string;
  appProperties?: Record<string, string>;
};

type UploadFileOptions = {
  file: File;
  category: string;
  owner: ExpenseOwner;
  filename: string;
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
};

export async function requestUploadSession(
  file: File,
  category: string,
  owner: ExpenseOwner,
  filename: string,
): Promise<string> {
  const mimeType = resolveUploadMimeType(filename, file.type);

  const response = await fetch("/api/drive/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename,
      mimeType,
      fileSize: file.size,
      category,
      owner,
    }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Unable to start Google Drive upload");
  }

  const data = (await response.json()) as UploadSessionResponse;
  return data.sessionUri;
}

export function uploadFileToSession(
  file: File,
  sessionUri: string,
  filename: string,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<DriveUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const mimeType = resolveUploadMimeType(filename, file.type);
    let settled = false;

    xhr.open("PUT", sessionUri);
    xhr.setRequestHeader("Content-Type", mimeType);

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      callback();
    };

    const onAbort = () => {
      xhr.abort();
      finish(() => reject(new Error("Upload cancelled")));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      finish(() => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as DriveUploadResult);
          } catch {
            resolve({ id: "" });
          }
          return;
        }

        reject(new Error(`Google Drive upload failed with status ${xhr.status}`));
      });
    });

    xhr.addEventListener("error", () => {
      finish(() => reject(new Error("Network error during Google Drive upload")));
    });

    xhr.addEventListener("abort", () => {
      finish(() => reject(new Error("Upload cancelled")));
    });

    xhr.send(file);
  });
}

export async function uploadFileToDrive({
  file,
  category,
  owner,
  filename,
  onProgress,
  signal,
}: UploadFileOptions): Promise<DriveUploadResult> {
  const sessionUri = await requestUploadSession(file, category, owner, filename);
  return uploadFileToSession(file, sessionUri, filename, onProgress, signal);
}

export async function uploadFilesToDrive(
  files: Array<{ file: File; filename: string }>,
  category: string,
  owner: ExpenseOwner,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<DriveUploadResult[]> {
  const results: DriveUploadResult[] = [];
  const totalFiles = files.length;

  for (let index = 0; index < files.length; index += 1) {
    const current = files[index];
    const startProgress = (index / totalFiles) * 100;
    const endProgress = ((index + 1) / totalFiles) * 100;

    const result = await uploadFileToDrive({
      file: current.file,
      category,
      owner,
      filename: current.filename,
      signal,
      onProgress: (fileProgress) => {
        const overall = startProgress + (fileProgress / 100) * (endProgress - startProgress);
        onProgress(overall);
      },
    });

    results.push(result);
  }

  onProgress(100);
  return results;
}
