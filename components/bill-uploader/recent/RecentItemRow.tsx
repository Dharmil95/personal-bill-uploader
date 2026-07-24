import { COLORS, OWNER_LABELS } from "@/lib/bill-uploader/constants";
import type { RecentItem } from "@/lib/bill-uploader/types";

type RecentItemRowProps = {
  item: RecentItem;
  onOpen: (item: RecentItem) => void;
  onDelete: (item: RecentItem) => void;
};

export function RecentItemRow({ item, onOpen, onDelete }: RecentItemRowProps) {
  const hasThumb = item.fileType === "image" && !!item.thumb;
  const isPdf = item.fileType === "pdf";
  const isTxt = item.fileType === "txt";

  return (
    <div className="flex items-center gap-2 rounded-[14px] border border-black/[0.07] bg-white p-3">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
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
          {isTxt ? (
            <div
              className="flex h-[30px] w-6 items-center justify-center rounded-[3px] text-[8px] font-bold text-white"
              style={{ background: COLORS.primary }}
            >
              TXT
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" style={{ color: COLORS.text }}>
            {item.filename}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: COLORS.primaryMuted, color: COLORS.primaryDark }}
            >
              {OWNER_LABELS[item.owner]}
            </span>
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
      <button
        type="button"
        onClick={() => onDelete(item)}
        aria-label={`Delete ${item.filename}`}
        className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full"
        style={{ background: "#fdecec", color: COLORS.pdf }}
      >
        ×
      </button>
    </div>
  );
}
