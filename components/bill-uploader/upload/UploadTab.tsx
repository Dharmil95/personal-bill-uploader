import type { RefObject } from "react";

import { COLORS } from "@/lib/bill-uploader/constants";
import type { ExpenseOwner, SelectedFile, UploadMode } from "@/lib/bill-uploader/types";

import { CategoryChips } from "./CategoryChips";
import { FilePickerActions } from "./FilePickerActions";
import { OwnerChips } from "./OwnerChips";
import { SelectedFilesGrid } from "./SelectedFilesGrid";
import { SubmitBar } from "./SubmitBar";

type UploadTabProps = {
  uploadMode: UploadMode;
  files: SelectedFile[];
  smsText: string;
  smsDate: string;
  categories: string[];
  selectedOwner: ExpenseOwner;
  selectedCategory: string | null;
  customMode: boolean;
  customText: string;
  uploading: boolean;
  canSubmit: boolean;
  submitLabel: string;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadModeChange: (mode: UploadMode) => void;
  onSmsTextChange: (value: string) => void;
  onSmsDateChange: (value: string) => void;
  onFilesChosen: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerCamera: () => void;
  onTriggerFile: () => void;
  onRemoveFile: (id: string) => void;
  onSelectOwner: (owner: ExpenseOwner) => void;
  onSelectCategory: (name: string) => void;
  onToggleCustomMode: () => void;
  onCustomTextChange: (value: string) => void;
  onConfirmCustomCategory: () => void;
  onSubmit: () => void;
};

function UploadModeToggle({
  mode,
  onChange,
}: {
  mode: UploadMode;
  onChange: (mode: UploadMode) => void;
}) {
  return (
    <div
      className="mb-4 flex rounded-[12px] border border-black/[0.07] p-1"
      style={{ background: COLORS.pageBg }}
    >
      {(["photo", "sms"] as const).map((option) => {
        const active = mode === option;
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
            {option === "photo" ? "Photo" : "SMS"}
          </button>
        );
      })}
    </div>
  );
}

export function UploadTab({
  uploadMode,
  files,
  smsText,
  smsDate,
  categories,
  selectedOwner,
  selectedCategory,
  customMode,
  customText,
  canSubmit,
  submitLabel,
  cameraInputRef,
  fileInputRef,
  onUploadModeChange,
  onSmsTextChange,
  onSmsDateChange,
  onFilesChosen,
  onTriggerCamera,
  onTriggerFile,
  onRemoveFile,
  onSelectOwner,
  onSelectCategory,
  onToggleCustomMode,
  onCustomTextChange,
  onConfirmCustomCategory,
  onSubmit,
}: UploadTabProps) {
  const isSmsMode = uploadMode === "sms";

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        <UploadModeToggle mode={uploadMode} onChange={onUploadModeChange} />

        {isSmsMode ? (
          <div className="mb-4">
            <label
              htmlFor="sms-text"
              className="mb-2 block text-[13px] font-semibold"
              style={{ color: COLORS.text }}
            >
              Paste SMS
            </label>
            <textarea
              id="sms-text"
              value={smsText}
              onChange={(event) => onSmsTextChange(event.target.value)}
              placeholder="Paste your UPI or bank payment SMS here…"
              rows={6}
              className="w-full resize-y rounded-[12px] border border-black/[0.08] px-3 py-2.5 text-[13.5px] outline-none focus:border-[rgba(0,0,0,0.18)]"
              style={{ color: COLORS.text, background: "#fff" }}
            />
            <label
              htmlFor="sms-date"
              className="mb-2 mt-4 block text-[13px] font-semibold"
              style={{ color: COLORS.text }}
            >
              Transaction date
            </label>
            <input
              id="sms-date"
              type="date"
              value={smsDate}
              onChange={(event) => onSmsDateChange(event.target.value)}
              className="w-full rounded-[12px] border border-black/[0.08] px-3 py-2.5 text-[13.5px] outline-none focus:border-[rgba(0,0,0,0.18)]"
              style={{ color: COLORS.text, background: "#fff" }}
            />
          </div>
        ) : (
          <>
            <FilePickerActions
              cameraInputRef={cameraInputRef}
              fileInputRef={fileInputRef}
              onFilesChosen={onFilesChosen}
              onTriggerCamera={onTriggerCamera}
              onTriggerFile={onTriggerFile}
            />
            <SelectedFilesGrid files={files} onRemove={onRemoveFile} />
          </>
        )}

        <OwnerChips selectedOwner={selectedOwner} onSelectOwner={onSelectOwner} />
        <CategoryChips
          categories={categories}
          selectedCategory={selectedCategory}
          customMode={customMode}
          customText={customText}
          onSelectCategory={onSelectCategory}
          onToggleCustomMode={onToggleCustomMode}
          onCustomTextChange={onCustomTextChange}
          onConfirmCustomCategory={onConfirmCustomCategory}
        />
        <div className="h-1" />
      </div>
      <SubmitBar label={submitLabel} canSubmit={canSubmit} onSubmit={onSubmit} />
    </>
  );
}
