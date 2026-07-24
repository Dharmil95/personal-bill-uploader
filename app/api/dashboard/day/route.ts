import { NextResponse } from "next/server";

import { fetchDayDetail } from "@/lib/dashboard/repository";
import { isValidIsoDate } from "@/lib/dashboard/date";
import { parseDashboardOwnerFilter } from "@/lib/bill-uploader/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date")?.trim() ?? "";
    const ownerFilter = parseDashboardOwnerFilter(searchParams.get("owner"));

    if (!isValidIsoDate(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    const detail = await fetchDayDetail(date, ownerFilter);
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load day expenses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
