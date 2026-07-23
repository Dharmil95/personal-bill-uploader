import { NextResponse } from "next/server";

import { fetchExpenseDetail } from "@/lib/dashboard/repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const detail = await fetchExpenseDetail(id);

    if (!detail) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load expense detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
