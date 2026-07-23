import { OwnerFilterChips } from "@/components/bill-uploader/recent/OwnerFilterChips";
import { COLORS } from "@/lib/bill-uploader/constants";
import type { RecentOwnerFilter } from "@/lib/bill-uploader/types";
import type { DashboardSummary } from "@/lib/dashboard/types";

import { BillsList } from "./BillsList";
import { CategorySpendList } from "./CategorySpendList";
import { OwnerSpendBar } from "./OwnerSpendBar";
import { ProcessStatusStrip } from "./ProcessStatusStrip";
import { StatCards } from "./StatCards";
import { TopVendorsList } from "./TopVendorsList";

type DashboardTabProps = {
  summary: DashboardSummary | null;
  loading: boolean;
  filterOwner: RecentOwnerFilter;
  onOwnerFilterChange: (owner: RecentOwnerFilter) => void;
  onSelectBill: (billId: string) => void;
};

export function DashboardTab({
  summary,
  loading,
  filterOwner,
  onOwnerFilterChange,
  onSelectBill,
}: DashboardTabProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 pb-5 text-[13.5px]" style={{ color: COLORS.textSubtle }}>
        Loading dashboard…
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 pb-5 text-[13.5px]" style={{ color: COLORS.textSubtle }}>
        Dashboard unavailable. Check Supabase env vars.
      </div>
    );
  }

  const maxCategoryAmount = summary.byCategory[0]?.amount ?? 0;
  const hasExpenses = summary.billCount > 0;

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
      <OwnerFilterChips filterOwner={filterOwner} onSelect={onOwnerFilterChange} />

      {!hasExpenses ? (
        <div
          className="mb-4 rounded-[14px] border border-dashed px-4 py-6 text-center text-[13px]"
          style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
        >
          No spend data yet. Upload bills and run the local processor to populate the dashboard.
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        <StatCards summary={summary} />
        <ProcessStatusStrip status={summary.processStatus} />
        <OwnerSpendBar summary={summary} />
        <CategorySpendList
          categories={summary.byCategory}
          currency={summary.currency}
          maxAmount={maxCategoryAmount}
        />
        <TopVendorsList vendors={summary.topVendors} currency={summary.currency} />
        <BillsList bills={summary.bills} onSelectBill={onSelectBill} />
      </div>
    </div>
  );
}
