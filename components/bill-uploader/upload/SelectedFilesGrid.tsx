import type { SelectedFile } from "@/lib/bill-uploader/types";
import { formatFileCountLabel } from "@/lib/bill-uploader/utils";

import { FileTile } from "./FileTile";

type SelectedFilesGridProps = {
  files: SelectedFile[];
  onRemove: (id: string) => void;
};

export function SelectedFilesGrid({ files, onRemove }: SelectedFilesGridProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[#49454f]">
        {formatFileCountLabel(files.length)}
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        {files.map((file) => (
          <FileTile
            key={file.id}
            name={file.name}
            isPdf={file.isPdf}
            previewUrl={file.previewUrl}
            onRemove={() => onRemove(file.id)}
          />
        ))}
      </div>
    </>
  );
}
