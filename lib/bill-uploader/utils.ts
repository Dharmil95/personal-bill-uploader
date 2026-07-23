export function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatFileCountLabel(count: number): string {
  return `${count} file${count === 1 ? "" : "s"} selected`;
}

export function formatRecentTotal(count: number): string {
  return `${count} file${count === 1 ? "" : "s"} total`;
}

export function isPdfFile(file: File): boolean {
  return resolveUploadMimeType(file.name, file.type) === "application/pdf";
}

export function resolveUploadMimeType(filename: string, mimeType?: string | null): string {
  const provided = mimeType?.trim() || "";

  if (provided && provided !== "application/octet-stream") {
    return provided;
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
    return "image/heic";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".jpe")) {
    return "image/jpeg";
  }

  // Camera captures often omit MIME type and sometimes omit an extension.
  if (!filename.includes(".")) {
    return "image/jpeg";
  }

  return provided || "application/octet-stream";
}

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

export function buildUploadFilename(category: string, originalName: string): string {
  return `${slug(category)}_${todayISO()}_${originalName}`;
}

export function getFileTypeFromMime(mimeType: string): "image" | "pdf" {
  return mimeType === "application/pdf" ? "pdf" : "image";
}

export function formatDriveTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) {
    return `Today, ${time}`;
  }

  if (diffDays === 1) {
    return `Yesterday, ${time}`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isAllowedUploadFile(file: File): boolean {
  return isAllowedMimeType(resolveUploadMimeType(file.name, file.type));
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
