import type { RefObject } from "react";

import { COLORS } from "@/lib/bill-uploader/constants";

type FilePickerActionsProps = {
  cameraInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesChosen: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerCamera: () => void;
  onTriggerFile: () => void;
};

export function FilePickerActions({
  cameraInputRef,
  fileInputRef,
  onFilesChosen,
  onTriggerCamera,
  onTriggerFile,
}: FilePickerActionsProps) {
  return (
    <div className="mb-[18px] flex gap-2.5">
      <button
        type="button"
        onClick={onTriggerCamera}
        className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed px-2.5 py-4"
        style={{ background: COLORS.primaryLight, borderColor: COLORS.primary }}
      >
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
          style={{ background: COLORS.primary }}
        >
          <div className="relative h-[11px] w-3.5 rounded-[3px] border-2 border-white">
            <div className="absolute -top-[5px] left-[3px] h-[3px] w-1.5 rounded-[1px] bg-white" />
          </div>
        </div>
        <span className="text-[13px] font-medium" style={{ color: COLORS.primaryDark }}>
          Take Photo
        </span>
      </button>
      <button
        type="button"
        onClick={onTriggerFile}
        className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed bg-white px-2.5 py-4"
        style={{ borderColor: COLORS.borderLight }}
      >
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full"
          style={{ background: COLORS.pageBg }}
        >
          <div
            className="h-4 w-[13px] rounded-[2px] border-2"
            style={{ borderColor: COLORS.textMuted }}
          />
        </div>
        <span className="text-[13px] font-medium" style={{ color: COLORS.text }}>
          Choose File
        </span>
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilesChosen}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={onFilesChosen}
        className="hidden"
      />
    </div>
  );
}
