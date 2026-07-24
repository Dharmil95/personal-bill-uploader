import { NextResponse } from "next/server";

import { getAllowedOrigin } from "@/lib/auth/request";
import { uploadTextFile } from "@/lib/google-drive/uploadText";
import { buildSmsFilename, isValidExpenseOwner } from "@/lib/bill-uploader/utils";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  try {
    const origin = getAllowedOrigin(request);
    if (!origin) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    const body = (await request.json()) as {
      text?: string;
      billDate?: string;
      owner?: string;
      category?: string;
    };

    const text = body.text?.trim() ?? "";
    const billDate = body.billDate?.trim() ?? "";
    const category = body.category?.trim() ?? "";
    const owner = body.owner?.trim() ?? "";

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (!billDate || !ISO_DATE_PATTERN.test(billDate)) {
      return NextResponse.json({ error: "billDate must be YYYY-MM-DD" }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }

    if (!isValidExpenseOwner(owner)) {
      return NextResponse.json({ error: "owner must be me or parents" }, { status: 400 });
    }

    const filename = buildSmsFilename(category, billDate);
    const result = await uploadTextFile({
      text,
      filename,
      owner,
      category,
      billDate,
    });

    return NextResponse.json({
      id: result.id,
      name: result.name,
      webViewLink: result.webViewLink ?? null,
      mimeType: result.mimeType ?? "text/plain",
      createdTime: result.createdTime ?? null,
      appProperties: result.appProperties ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMS upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
