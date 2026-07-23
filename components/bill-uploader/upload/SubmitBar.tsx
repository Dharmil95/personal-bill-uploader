import { COLORS } from "@/lib/bill-uploader/constants";

type SubmitBarProps = {
  label: string;
  canSubmit: boolean;
  onSubmit: () => void;
};

export function SubmitBar({ label, canSubmit, onSubmit }: SubmitBarProps) {
  return (
    <div
      className="flex-none px-5 pb-[22px] pt-3.5 shadow-[0_-6px_20px_rgba(0,0,0,0.05)]"
      style={{ background: COLORS.shellBg }}
    >
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full cursor-pointer rounded-[14px] py-[15px] text-center text-[15.5px] font-semibold disabled:cursor-default"
        style={{
          background: canSubmit ? COLORS.primary : COLORS.disabledBg,
          color: canSubmit ? "#fff" : COLORS.textSubtle,
        }}
      >
        {label}
      </button>
    </div>
  );
}
