import { NextResponse } from "next/server";

import { listRecentFiles, parseDriveFileOwner } from "@/lib/google-drive/client";
import { formatDriveTimestamp, getFileTypeFromMime, parseRecentOwnerFilter } from "@/lib/bill-uploader/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const ownerFilter = parseRecentOwnerFilter(searchParams.get("owner"));

    const files = await listRecentFiles({
      owner: ownerFilter === "everyone" ? undefined : ownerFilter,
      category: category && category !== "All" ? category : undefined,
    });

    const items = files
      .filter((file) => file.mimeType !== "application/vnd.google-apps.folder")
      .map((file) => ({
        id: file.id,
        filename: file.name,
        category: file.appProperties?.category ?? "Uncategorized",
        owner: parseDriveFileOwner(file.appProperties),
        fileType: getFileTypeFromMime(file.mimeType),
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
