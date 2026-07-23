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
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function buildUploadFilename(category: string, originalName: string): string {
  return `${slug(category)}_${todayISO()}_${originalName}`;
}
