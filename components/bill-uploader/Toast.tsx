import { COLORS } from "@/lib/bill-uploader/constants";

type ToastProps = {
  message: string;
};

export function Toast({ message }: ToastProps) {
  return (
    <div
      className="absolute left-5 right-5 top-3.5 z-40 flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      style={{ background: COLORS.toastBg }}
    >
      <div
        className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-xs font-bold"
        style={{ background: COLORS.toastAccent, color: "#00382f" }}
      >
        ✓
      </div>
      {message}
    </div>
  );
}
