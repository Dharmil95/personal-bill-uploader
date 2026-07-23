import { NextResponse } from "next/server";

import { listCategoryFolders } from "@/lib/google-drive/client";
import { SEED_CATEGORIES } from "@/lib/bill-uploader/constants";
import { parseRecentOwnerFilter } from "@/lib/bill-uploader/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerFilter = parseRecentOwnerFilter(searchParams.get("owner"));
    const driveCategories = await listCategoryFolders(ownerFilter);
    const merged = Array.from(new Set([...SEED_CATEGORIES, ...driveCategories]));
    return NextResponse.json({ categories: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load categories";
    return NextResponse.json({ error: message, categories: [...SEED_CATEGORIES] }, { status: 500 });
  }
}
