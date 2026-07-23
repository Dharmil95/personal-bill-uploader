import { COLORS } from "@/lib/bill-uploader/constants";
import { formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardCategorySpend } from "@/lib/dashboard/types";

type CategorySpendListProps = {
  categories: DashboardCategorySpend[];
  currency: string;
  maxAmount: number;
};

export function CategorySpendList({ categories, currency, maxAmount }: CategorySpendListProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
        By category
      </div>
      <div className="flex flex-col gap-3">
        {categories.map((item) => {
          const widthPct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;

          return (
            <div key={item.category}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[12.5px] font-medium" style={{ color: COLORS.text }}>
                  {item.category}
                </span>
                <span className="flex-none text-[12px]" style={{ color: COLORS.textMuted }}>
                  {formatInrAmount(item.amount, currency)} · {item.count}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: COLORS.progressTrack }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${widthPct}%`, background: COLORS.primary }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
