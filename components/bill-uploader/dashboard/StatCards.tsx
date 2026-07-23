import { COLORS } from "@/lib/bill-uploader/constants";
import { formatInrAmount, formatMonthChangePct } from "@/lib/dashboard/format";
import type { DashboardSummary } from "@/lib/dashboard/types";

type StatCardsProps = {
  summary: DashboardSummary;
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="rounded-[14px] border border-black/[0.07] bg-white p-3.5"
      style={{ minHeight: 88 }}
    >
      <div className="text-[11.5px] font-medium" style={{ color: COLORS.textSubtle }}>
        {label}
      </div>
      <div className="mt-1.5 text-[19px] font-semibold tracking-[-0.3px]" style={{ color: COLORS.text }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function StatCards({ summary }: StatCardsProps) {
  const monthHint =
    summary.lastMonthSpend > 0
      ? `This month ${formatInrAmount(summary.monthSpend, summary.currency)} · Last month ${formatInrAmount(summary.lastMonthSpend, summary.currency)}${summary.monthChangePct != null ? ` · ${formatMonthChangePct(summary.monthChangePct)}` : ""}`
      : summary.monthBillCount > 0
        ? `${summary.monthBillCount} bill${summary.monthBillCount === 1 ? "" : "s"} this month`
        : undefined;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatCard
        label="Total spent"
        value={formatInrAmount(summary.totalSpend, summary.currency)}
      />
      <StatCard
        label="This month"
        value={formatInrAmount(summary.monthSpend, summary.currency)}
        hint={monthHint}
      />
      <StatCard label="Bills" value={String(summary.billCount)} />
      <StatCard
        label="Avg bill"
        value={
          summary.avgBillAmount != null
            ? formatInrAmount(summary.avgBillAmount, summary.currency)
            : "—"
        }
      />
    </div>
  );
}
