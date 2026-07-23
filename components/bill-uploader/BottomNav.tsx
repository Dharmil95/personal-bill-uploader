import { COLORS } from "@/lib/bill-uploader/constants";
import type { Tab } from "@/lib/bill-uploader/types";

type BottomNavProps = {
  activeTab: Tab;
  onUpload: () => void;
  onRecent: () => void;
  onDashboard: () => void;
};

function tabStyle(active: boolean) {
  return {
    background: active ? COLORS.primaryMuted : "transparent",
    borderColor: active ? COLORS.primary : COLORS.textSubtle,
    color: active ? COLORS.primary : COLORS.textSubtle,
  } as const;
}

export function BottomNav({ activeTab, onUpload, onRecent, onDashboard }: BottomNavProps) {
  const uploadStyle = tabStyle(activeTab === "upload");
  const recentStyle = tabStyle(activeTab === "recent");
  const dashboardStyle = tabStyle(activeTab === "dashboard");

  return (
    <div className="flex flex-none border-t border-black/[0.06] bg-white">
      <button
        type="button"
        onClick={onUpload}
        className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 pb-2"
      >
        <div
          className="flex h-6 w-10 items-center justify-center rounded-xl"
          style={{ background: uploadStyle.background }}
        >
          <div
            className="h-4 w-4 rounded-[3px] border-2"
            style={{ borderColor: uploadStyle.borderColor }}
          />
        </div>
        <span className="text-[11.5px] font-medium" style={{ color: uploadStyle.color }}>
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
          style={{ background: recentStyle.background }}
        >
          <div
            className="h-4 w-4 rounded-full border-2"
            style={{ borderColor: recentStyle.borderColor }}
          />
        </div>
        <span className="text-[11.5px] font-medium" style={{ color: recentStyle.color }}>
          Recent
        </span>
      </button>
      <button
        type="button"
        onClick={onDashboard}
        className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 pb-2"
      >
        <div
          className="flex h-6 w-10 items-center justify-center rounded-xl"
          style={{ background: dashboardStyle.background }}
        >
          <div className="flex h-3.5 items-end gap-[3px]">
            <div
              className="w-[3px] rounded-[1px]"
              style={{ height: 8, background: dashboardStyle.borderColor }}
            />
            <div
              className="w-[3px] rounded-[1px]"
              style={{ height: 12, background: dashboardStyle.borderColor }}
            />
            <div
              className="w-[3px] rounded-[1px]"
              style={{ height: 6, background: dashboardStyle.borderColor }}
            />
          </div>
        </div>
        <span className="text-[11.5px] font-medium" style={{ color: dashboardStyle.color }}>
          Dashboard
        </span>
      </button>
    </div>
  );
}
