import type { CSSProperties } from "react";

import { COLORS } from "@/lib/bill-uploader/constants";

type CategoryChipsProps = {
  categories: string[];
  selectedCategory: string | null;
  customMode: boolean;
  customText: string;
  onSelectCategory: (name: string) => void;
  onToggleCustomMode: () => void;
  onCustomTextChange: (value: string) => void;
  onConfirmCustomCategory: () => void;
};

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "9px 16px",
    borderRadius: "100px",
    fontSize: "13.5px",
    fontWeight: 500,
    cursor: "pointer",
    border: `1.5px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? COLORS.primary : "#fff",
    color: active ? "#fff" : COLORS.text,
  };
}

export function CategoryChips({
  categories,
  selectedCategory,
  customMode,
  customText,
  onSelectCategory,
  onToggleCustomMode,
  onCustomTextChange,
  onConfirmCustomCategory,
}: CategoryChipsProps) {
  return (
    <>
      <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[#49454f]">
        Category
      </div>
      <div className="mb-3.5 flex flex-wrap gap-2">
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onSelectCategory(name)}
            style={chipStyle(selectedCategory === name)}
          >
            {name}
          </button>
        ))}
        {customMode ? (
          <>
            <input
              value={customText}
              onChange={(event) => onCustomTextChange(event.target.value)}
              placeholder="New category name"
              autoFocus
              className="min-w-[150px] rounded-full border-[1.5px] px-3.5 py-2 font-[inherit] text-[13.5px] outline-none"
              style={{ borderColor: COLORS.primary }}
            />
            <button
              type="button"
              onClick={onConfirmCustomCategory}
              className="cursor-pointer rounded-full px-4 py-2 text-[13.5px] font-medium text-white"
              style={{ background: COLORS.primary }}
            >
              Add
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCustomMode}
            className="cursor-pointer rounded-full border-[1.5px] border-dashed px-4 py-2 text-[13.5px] font-medium"
            style={{ borderColor: COLORS.textSubtle, color: COLORS.textMuted }}
          >
            + New
          </button>
        )}
      </div>
    </>
  );
}
