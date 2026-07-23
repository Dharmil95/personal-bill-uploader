import { COLORS, OWNER_LABELS } from "@/lib/bill-uploader/constants";
import { formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardSummary } from "@/lib/dashboard/types";

type OwnerSpendBarProps = {
  summary: DashboardSummary;
};

export function OwnerSpendBar({ summary }: OwnerSpendBarProps) {
  if (summary.ownerFilter !== "everyone") {
    return null;
  }

  const total = summary.byOwner.me + summary.byOwner.parents;
  if (total <= 0) {
    return null;
  }

  const mePct = (summary.byOwner.me / total) * 100;
  const parentsPct = 100 - mePct;

  return (
    <section>
      <div className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
        By who
      </div>
      <div className="overflow-hidden rounded-full" style={{ background: COLORS.progressTrack, height: 10 }}>
        <div className="flex h-full w-full">
          <div style={{ width: `${mePct}%`, background: COLORS.primary }} />
          <div style={{ width: `${parentsPct}%`, background: COLORS.primaryMuted }} />
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[12.5px]">
          <span style={{ color: COLORS.textMuted }}>{OWNER_LABELS.me}</span>
          <span className="font-semibold" style={{ color: COLORS.text }}>
            {formatInrAmount(summary.byOwner.me, summary.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12.5px]">
          <span style={{ color: COLORS.textMuted }}>{OWNER_LABELS.parents}</span>
          <span className="font-semibold" style={{ color: COLORS.text }}>
            {formatInrAmount(summary.byOwner.parents, summary.currency)}
          </span>
        </div>
      </div>
    </section>
  );
}
