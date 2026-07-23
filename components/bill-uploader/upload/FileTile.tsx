import { COLORS } from "@/lib/bill-uploader/constants";

type FileTileProps = {
  name: string;
  isPdf: boolean;
  previewUrl: string | null;
  onRemove: () => void;
};

export function FileTile({ name, isPdf, previewUrl, onRemove }: FileTileProps) {
  return (
    <div
      className="relative aspect-square overflow-hidden rounded-xl border border-black/[0.06]"
      style={{ background: COLORS.pageBg }}
    >
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={name} className="block h-full w-full object-cover" />
      ) : null}
      {isPdf ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-1.5">
          <div
            className="flex h-[34px] w-7 items-center justify-center rounded-[3px] text-[9px] font-bold text-white"
            style={{ background: COLORS.pdf }}
          >
            PDF
          </div>
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-1.5 pb-1 pt-3 text-[10px] text-white">
        {name}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-xs text-white"
        style={{ background: "rgba(0,0,0,0.55)" }}
        aria-label={`Remove ${name}`}
      >
        ✕
      </button>
    </div>
  );
}
