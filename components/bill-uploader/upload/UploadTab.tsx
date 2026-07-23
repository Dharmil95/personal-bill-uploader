import type { RefObject } from "react";

import type { SelectedFile } from "@/lib/bill-uploader/types";

import { CategoryChips } from "./CategoryChips";
import { FilePickerActions } from "./FilePickerActions";
import { SelectedFilesGrid } from "./SelectedFilesGrid";
import { SubmitBar } from "./SubmitBar";

type UploadTabProps = {
  files: SelectedFile[];
  categories: string[];
  selectedCategory: string | null;
  customMode: boolean;
  customText: string;
  uploading: boolean;
  canSubmit: boolean;
  submitLabel: string;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesChosen: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerCamera: () => void;
  onTriggerFile: () => void;
  onRemoveFile: (id: string) => void;
  onSelectCategory: (name: string) => void;
  onToggleCustomMode: () => void;
  onCustomTextChange: (value: string) => void;
  onConfirmCustomCategory: () => void;
  onSubmit: () => void;
};

export function UploadTab({
  files,
  categories,
  selectedCategory,
  customMode,
  customText,
  canSubmit,
  submitLabel,
  cameraInputRef,
  fileInputRef,
  onFilesChosen,
  onTriggerCamera,
  onTriggerFile,
  onRemoveFile,
  onSelectCategory,
  onToggleCustomMode,
  onCustomTextChange,
  onConfirmCustomCategory,
  onSubmit,
}: UploadTabProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        <FilePickerActions
          cameraInputRef={cameraInputRef}
          fileInputRef={fileInputRef}
          onFilesChosen={onFilesChosen}
          onTriggerCamera={onTriggerCamera}
          onTriggerFile={onTriggerFile}
        />
        <SelectedFilesGrid files={files} onRemove={onRemoveFile} />
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
