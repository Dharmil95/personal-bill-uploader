import { NextResponse } from "next/server";

import { buildDashboardSummary } from "@/lib/dashboard/aggregate";
import { fetchDashboardSummaryData } from "@/lib/dashboard/repository";
import { parseDashboardOwnerFilter } from "@/lib/bill-uploader/utils";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerFilter = parseDashboardOwnerFilter(searchParams.get("owner"));
    const { expenses, driveFiles, lineItemCounts } = await fetchDashboardSummaryData();

    const summary = buildDashboardSummary({
      ownerFilter,
      expenses,
      driveFiles,
      lineItemCounts,
    });

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
