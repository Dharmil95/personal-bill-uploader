import { OwnerFilterChips } from "@/components/bill-uploader/recent/OwnerFilterChips";
import { COLORS } from "@/lib/bill-uploader/constants";
import type { RecentOwnerFilter } from "@/lib/bill-uploader/types";
import type { DashboardDayDetail, DashboardSummary } from "@/lib/dashboard/types";

import { BillsList } from "./BillsList";
import { CategorySpendList } from "./CategorySpendList";
import { DashboardViewToggle, type DashboardView } from "./DashboardViewToggle";
import { DayExpensesList } from "./DayExpensesList";
import { OwnerSpendBar } from "./OwnerSpendBar";
import { ProcessStatusStrip } from "./ProcessStatusStrip";
import { SpendCalendar } from "./SpendCalendar";
import { StatCards } from "./StatCards";
import { TopVendorsList } from "./TopVendorsList";

type DashboardTabProps = {
  summary: DashboardSummary | null;
  loading: boolean;
  filterOwner: RecentOwnerFilter;
  dashboardView: DashboardView;
  selectedDate: string | null;
  dayDetail: DashboardDayDetail | null;
  dayLoading: boolean;
  onOwnerFilterChange: (owner: RecentOwnerFilter) => void;
  onDashboardViewChange: (view: DashboardView) => void;
  onSelectDate: (date: string) => void;
  onCalendarMonthChange: () => void;
  onSelectBill: (billId: string) => void;
};

export function DashboardTab({
  summary,
  loading,
  filterOwner,
  dashboardView,
  selectedDate,
  dayDetail,
  dayLoading,
  onOwnerFilterChange,
  onDashboardViewChange,
  onSelectDate,
  onCalendarMonthChange,
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
  const isOverview = dashboardView === "overview";

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
      <OwnerFilterChips filterOwner={filterOwner} onSelect={onOwnerFilterChange} />
      <DashboardViewToggle view={dashboardView} onChange={onDashboardViewChange} />

      {!hasExpenses ? (
        <div
          className="mb-4 rounded-[14px] border border-dashed px-4 py-6 text-center text-[13px]"
          style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
        >
          No spend data yet. Upload bills and run the local processor to populate the dashboard.
        </div>
      ) : null}

      {isOverview ? (
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
      ) : (
        <div className="flex flex-col gap-5">
          <SpendCalendar
            key={summary.ownerFilter}
            spend={summary.dailySpend}
            currency={summary.currency}
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onMonthChange={onCalendarMonthChange}
          />
          <DayExpensesList
            detail={dayDetail}
            loading={dayLoading}
            selectedDate={selectedDate}
            onSelectBill={onSelectBill}
          />
        </div>
      )}
    </div>
  );
}
