import { NextResponse } from "next/server";

import { deleteBillFromDatabase, updateBillReviewStatus } from "@/lib/bills/repository";
import { trashDriveFile } from "@/lib/google-drive/client";
import type { ReviewStatus } from "@/lib/supabase/types";

type RouteContext = {
  params: Promise<{ driveFileId: string }>;
};

function parseReviewStatus(value: unknown): ReviewStatus | null {
  if (value === "active" || value === "invalid") {
    return value;
  }

  return null;
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { driveFileId } = await context.params;

    if (!driveFileId.trim()) {
      return NextResponse.json({ error: "driveFileId is required" }, { status: 400 });
    }

    await trashDriveFile(driveFileId);
    await deleteBillFromDatabase(driveFileId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete bill";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { driveFileId } = await context.params;

    if (!driveFileId.trim()) {
      return NextResponse.json({ error: "driveFileId is required" }, { status: 400 });
    }

    const body = (await request.json()) as { reviewStatus?: unknown };
    const reviewStatus = parseReviewStatus(body.reviewStatus);

    if (!reviewStatus) {
      return NextResponse.json(
        { error: "reviewStatus must be active or invalid" },
        { status: 400 },
      );
    }

    const updatedStatus = await updateBillReviewStatus(driveFileId, reviewStatus);

    return NextResponse.json({ driveFileId, reviewStatus: updatedStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update bill";

    if (message === "Bill not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
