import { COLORS } from "@/lib/bill-uploader/constants";
import { formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardVendorSpend } from "@/lib/dashboard/types";

type TopVendorsListProps = {
  vendors: DashboardVendorSpend[];
  currency: string;
};

export function TopVendorsList({ vendors, currency }: TopVendorsListProps) {
  if (vendors.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
        Top vendors
      </div>
      <div className="flex flex-col gap-2">
        {vendors.map((vendor) => (
          <div
            key={vendor.vendor}
            className="flex items-center justify-between rounded-[12px] border border-black/[0.06] bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium" style={{ color: COLORS.text }}>
                {vendor.vendor}
              </div>
              <div className="text-[11px]" style={{ color: COLORS.textSubtle }}>
                {vendor.count} bill{vendor.count === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex-none text-[13px] font-semibold" style={{ color: COLORS.primaryDark }}>
              {formatInrAmount(vendor.amount, currency)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
