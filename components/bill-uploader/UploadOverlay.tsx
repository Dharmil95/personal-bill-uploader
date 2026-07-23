import { COLORS } from "@/lib/bill-uploader/constants";

type UploadOverlayProps = {
  progress: number;
  destinationLabel: string;
};

export function UploadOverlay({ progress, destinationLabel }: UploadOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-[18px] px-[30px] py-[30px]"
      style={{ background: "rgba(247,250,249,0.97)" }}
    >
      <div
        className="animate-spin-slow h-16 w-16 rounded-full border-[5px]"
        style={{ borderColor: COLORS.progressRing, borderTopColor: COLORS.primary }}
      />
      <div className="text-[15px] font-medium" style={{ color: COLORS.text }}>
        Uploading to Google Drive…
      </div>
      <div
        className="h-1.5 w-[200px] overflow-hidden rounded-full"
        style={{ background: COLORS.progressTrack }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%`, background: COLORS.primary }}
        />
      </div>
      <div className="text-[12.5px]" style={{ color: COLORS.textMuted }}>
        {destinationLabel}
      </div>
      <div className="text-center text-[11.5px]" style={{ color: COLORS.textSubtle }}>
        {progress}% complete
      </div>
    </div>
  );
}
