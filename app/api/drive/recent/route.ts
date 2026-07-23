import { NextResponse } from "next/server";

import { listRecentFiles } from "@/lib/google-drive/client";
import { formatDriveTimestamp, getFileTypeFromMime } from "@/lib/bill-uploader/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const files = await listRecentFiles(category === "All" ? undefined : category);

    const items = files
      .filter((file) => file.mimeType !== "application/vnd.google-apps.folder")
      .map((file) => ({
      id: file.id,
      filename: file.name,
      category: file.appProperties?.category ?? "Uncategorized",
      fileType: getFileTypeFromMime(file.mimeType),
      // Drive thumbnailLink often requires auth and fails in <img>; prefer opening the file.
      thumb: null,
      uploadedAt: file.createdTime ? formatDriveTimestamp(file.createdTime) : "Unknown",
      webViewLink: file.webViewLink ?? null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load recent uploads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
