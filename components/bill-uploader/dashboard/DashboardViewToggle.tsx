import { COLORS } from "@/lib/bill-uploader/constants";

export type DashboardView = "overview" | "calendar";

type DashboardViewToggleProps = {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
};

export function DashboardViewToggle({ view, onChange }: DashboardViewToggleProps) {
  return (
    <div
      className="mb-4 flex rounded-[12px] border border-black/[0.07] p-1"
      style={{ background: COLORS.pageBg }}
    >
      {(["overview", "calendar"] as const).map((option) => {
        const active = view === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className="flex-1 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: active ? "#fff" : "transparent",
              color: active ? COLORS.primaryDark : COLORS.textSubtle,
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {option === "overview" ? "Overview" : "Calendar"}
          </button>
        );
      })}
    </div>
  );
}
