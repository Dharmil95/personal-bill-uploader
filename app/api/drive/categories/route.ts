import { NextResponse } from "next/server";

import { listCategoryFolders } from "@/lib/google-drive/client";
import { SEED_CATEGORIES } from "@/lib/bill-uploader/constants";

export async function GET() {
  try {
    const driveCategories = await listCategoryFolders();
    const merged = Array.from(new Set([...SEED_CATEGORIES, ...driveCategories]));
    return NextResponse.json({ categories: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load categories";
    return NextResponse.json({ error: message, categories: [...SEED_CATEGORIES] }, { status: 500 });
  }
}
