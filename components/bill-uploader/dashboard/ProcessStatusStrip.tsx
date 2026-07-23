import { COLORS } from "@/lib/bill-uploader/constants";
import type { DashboardProcessStatus } from "@/lib/dashboard/types";

type ProcessStatusStripProps = {
  status: DashboardProcessStatus;
};

type StatusPill = {
  key: keyof DashboardProcessStatus;
  label: string;
  bg: string;
  color: string;
};

const PILLS: StatusPill[] = [
  { key: "pending", label: "Pending", bg: COLORS.primaryLight, color: COLORS.primary },
  { key: "processing", label: "Processing", bg: "#e8f0ff", color: "#2f5fd0" },
  { key: "done", label: "Done", bg: "#e7f6ef", color: "#1f7a4f" },
  { key: "failed", label: "Failed", bg: "#fdecec", color: COLORS.pdf },
];

export function ProcessStatusStrip({ status }: ProcessStatusStripProps) {
  const total = status.pending + status.processing + status.done + status.failed;
  if (total === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
        Processor status
      </div>
      <div className="flex flex-wrap gap-2">
        {PILLS.map((pill) => {
          const count = status[pill.key];
          if (count === 0) {
            return null;
          }

          return (
            <span
              key={pill.key}
              className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ background: pill.bg, color: pill.color }}
            >
              {pill.label} {count}
            </span>
          );
        })}
      </div>
    </section>
  );
}
