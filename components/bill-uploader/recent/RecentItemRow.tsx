import { COLORS } from "@/lib/bill-uploader/constants";
import type { RecentItem } from "@/lib/bill-uploader/types";

type RecentItemRowProps = {
  item: RecentItem;
  onOpen: (item: RecentItem) => void;
};

export function RecentItemRow({ item, onOpen }: RecentItemRowProps) {
  const hasThumb = item.fileType === "image" && !!item.thumb;
  const isPdf = item.fileType === "pdf";

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-black/[0.07] bg-white p-3 text-left"
    >
      <div
        className="flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-[10px]"
        style={{ background: COLORS.pageBg }}
      >
        {hasThumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumb!} alt={item.filename} className="h-full w-full object-cover" />
        ) : null}
        {isPdf ? (
          <div
            className="flex h-[30px] w-6 items-center justify-center rounded-[3px] text-[8px] font-bold text-white"
            style={{ background: COLORS.pdf }}
          >
            PDF
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium" style={{ color: COLORS.text }}>
          {item.filename}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: COLORS.primaryLight, color: COLORS.primary }}
          >
            {item.category}
          </span>
          <span className="text-[11.5px]" style={{ color: COLORS.textSubtle }}>
            {item.uploadedAt}
          </span>
        </div>
      </div>
      <div className="flex-none text-[15px]" style={{ color: COLORS.borderLight }}>
        ↗
      </div>
    </button>
  );
}
