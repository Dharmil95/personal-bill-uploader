import { NextResponse } from "next/server";

import { getAllowedOrigin } from "@/lib/auth/request";
import {
  createResumableUploadSession,
  ensureOwnerCategoryFolder,
  MAX_UPLOAD_BYTES,
} from "@/lib/google-drive/client";
import { isAllowedMimeType, isValidExpenseOwner, resolveUploadMimeType } from "@/lib/bill-uploader/utils";

export async function POST(request: Request) {
  try {
    const origin = getAllowedOrigin(request);
    if (!origin) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const body = (await request.json()) as {
      filename?: string;
      mimeType?: string;
      fileSize?: number;
      category?: string;
      owner?: string;
    };

    const filename = body.filename?.trim();
    const fileSize = body.fileSize ?? 0;
    const category = body.category?.trim();
    const owner = body.owner?.trim() ?? "";
    const mimeType = filename
      ? resolveUploadMimeType(filename, body.mimeType)
      : "application/octet-stream";

    if (!filename || !category) {
      return NextResponse.json({ error: "filename and category are required" }, { status: 400 });
    }

    if (!isValidExpenseOwner(owner)) {
      return NextResponse.json({ error: "owner must be me or parents" }, { status: 400 });
    }

    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json(
        { error: "Only images and PDF files are allowed" },
        { status: 400 },
      );
    }

    if (fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File size must be between 1 byte and 25 MB" },
        { status: 400 },
      );
    }

    const { folderId, accessToken } = await ensureOwnerCategoryFolder(owner, category);
    const sessionUri = await createResumableUploadSession({
      filename,
      mimeType,
      fileSize,
      category,
      owner,
      folderId,
      accessToken,
      origin,
    });

    return NextResponse.json({ sessionUri });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload session failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
