import { COLORS } from "@/lib/bill-uploader/constants";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/35 px-5 pb-8 pt-5">
      <div className="w-full rounded-[16px] bg-white p-5 shadow-lg">
        <div className="text-[17px] font-semibold" style={{ color: COLORS.text }}>
          {title}
        </div>
        <div className="mt-2 text-[13.5px] leading-5" style={{ color: COLORS.textMuted }}>
          {message}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-[12px] px-4 py-3 text-[13.5px] font-semibold disabled:opacity-60"
            style={{ background: COLORS.primaryLight, color: COLORS.primary }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-[12px] px-4 py-3 text-[13.5px] font-semibold text-white disabled:opacity-60"
            style={{ background: destructive ? COLORS.pdf : COLORS.primary }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
