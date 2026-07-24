import { COLORS, OWNER_LABELS } from "@/lib/bill-uploader/constants";
import { formatBillDate, formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardBillSummary } from "@/lib/dashboard/types";

type BillsListProps = {
  bills: DashboardBillSummary[];
  onSelectBill: (billId: string) => void;
  hideTitle?: boolean;
};

export function BillsList({ bills, onSelectBill, hideTitle = false }: BillsListProps) {
  return (
    <section>
      {!hideTitle ? (
        <div className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
          Bills
        </div>
      ) : null}
      {bills.length === 0 ? (
        <div
          className="rounded-[14px] border border-dashed px-4 py-8 text-center text-[13px]"
          style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
        >
          No processed bills yet. Upload a bill and run the local processor to see spend here.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {bills.map((bill) => {
            const isInvalid = bill.reviewStatus === "invalid";

            return (
            <button
              key={bill.id}
              type="button"
              onClick={() => onSelectBill(bill.id)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-black/[0.07] bg-white p-3 text-left"
              style={isInvalid ? { opacity: 0.72 } : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-sm font-medium" style={{ color: COLORS.text }}>
                    {bill.vendor?.trim() || bill.category}
                  </div>
                  <div className="flex-none text-sm font-semibold" style={{ color: COLORS.primaryDark }}>
                    {formatInrAmount(bill.amount, bill.currency)}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: COLORS.primaryMuted, color: COLORS.primaryDark }}
                  >
                    {OWNER_LABELS[bill.owner]}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: COLORS.primaryLight, color: COLORS.primary }}
                  >
                    {bill.category}
                  </span>
                  {isInvalid ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "#fdecec", color: COLORS.pdf }}
                    >
                      Invalid
                    </span>
                  ) : null}
                  <span className="text-[11.5px]" style={{ color: COLORS.textSubtle }}>
                    {formatBillDate(bill.billDate)}
                  </span>
                  {bill.lineItemCount > 0 ? (
                    <span className="text-[11.5px]" style={{ color: COLORS.textSubtle }}>
                      · {bill.lineItemCount} item{bill.lineItemCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex-none text-[15px]" style={{ color: COLORS.borderLight }}>
                ›
              </div>
            </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
