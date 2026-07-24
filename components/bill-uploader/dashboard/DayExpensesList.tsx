import { COLORS } from "@/lib/bill-uploader/constants";
import { formatBillDate, formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardDayDetail } from "@/lib/dashboard/types";

import { BillsList } from "./BillsList";

type DayExpensesListProps = {
  detail: DashboardDayDetail | null;
  loading: boolean;
  selectedDate: string | null;
  onSelectBill: (billId: string) => void;
};

export function DayExpensesList({
  detail,
  loading,
  selectedDate,
  onSelectBill,
}: DayExpensesListProps) {
  if (!selectedDate) {
    return (
      <div
        className="rounded-[14px] border border-dashed px-4 py-8 text-center text-[13px]"
        style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
      >
        Tap a date to see expenses for that day.
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="rounded-[14px] border border-black/[0.07] bg-white px-4 py-8 text-center text-[13px]"
        style={{ color: COLORS.textSubtle }}
      >
        Loading expenses…
      </div>
    );
  }

  if (!detail) {
    return (
      <div
        className="rounded-[14px] border border-dashed px-4 py-8 text-center text-[13px]"
        style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
      >
        Could not load expenses for this day.
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2">
        <div className="text-[13px] font-semibold" style={{ color: COLORS.text }}>
          {formatBillDate(detail.date)}
        </div>
        <div className="text-[11.5px]" style={{ color: COLORS.textSubtle }}>
          {formatInrAmount(detail.totalSpend, detail.currency)} · {detail.billCount} expense
          {detail.billCount === 1 ? "" : "s"}
        </div>
      </div>
      {detail.billCount === 0 ? (
        <div
          className="rounded-[14px] border border-dashed px-4 py-8 text-center text-[13px]"
          style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
        >
          No expenses on this day.
        </div>
      ) : (
        <BillsList bills={detail.bills} onSelectBill={onSelectBill} hideTitle />
      )}
    </section>
  );
}
