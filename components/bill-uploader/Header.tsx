import { COLORS } from "@/lib/bill-uploader/constants";

type HeaderProps = {
  title: string;
  subtitle: string;
};

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div
      className="flex flex-none items-center justify-between px-5 pb-3.5 pt-[18px]"
      style={{ background: COLORS.shellBg }}
    >
      <div>
        <div
          className="text-[22px] font-medium tracking-[-0.2px]"
          style={{ color: COLORS.text }}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[13px]" style={{ color: COLORS.textMuted }}>
          {subtitle}
        </div>
      </div>
      <div
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-[15px] font-semibold text-white"
        style={{ background: COLORS.primary }}
      >
        O
      </div>
    </div>
  );
}
