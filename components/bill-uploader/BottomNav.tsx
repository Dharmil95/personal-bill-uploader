import { COLORS } from "@/lib/bill-uploader/constants";
import type { Tab } from "@/lib/bill-uploader/types";

type BottomNavProps = {
  activeTab: Tab;
  onUpload: () => void;
  onRecent: () => void;
};

export function BottomNav({ activeTab, onUpload, onRecent }: BottomNavProps) {
  const isUpload = activeTab === "upload";

  return (
    <div className="flex flex-none border-t border-black/[0.06] bg-white">
      <button
        type="button"
        onClick={onUpload}
        className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 pb-2"
      >
        <div
          className="flex h-6 w-10 items-center justify-center rounded-xl"
          style={{ background: isUpload ? COLORS.primaryMuted : "transparent" }}
        >
          <div
            className="h-4 w-4 rounded-[3px] border-2"
            style={{ borderColor: isUpload ? COLORS.primary : COLORS.textSubtle }}
          />
        </div>
        <span
          className="text-[11.5px] font-medium"
          style={{ color: isUpload ? COLORS.primary : COLORS.textSubtle }}
        >
          Upload
        </span>
      </button>
      <button
        type="button"
        onClick={onRecent}
        className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 pb-2"
      >
        <div
          className="flex h-6 w-10 items-center justify-center rounded-xl"
          style={{ background: !isUpload ? COLORS.primaryMuted : "transparent" }}
        >
          <div
            className="h-4 w-4 rounded-full border-2"
            style={{ borderColor: !isUpload ? COLORS.primary : COLORS.textSubtle }}
          />
        </div>
        <span
          className="text-[11.5px] font-medium"
          style={{ color: !isUpload ? COLORS.primary : COLORS.textSubtle }}
        >
          Recent
        </span>
      </button>
    </div>
  );
}
