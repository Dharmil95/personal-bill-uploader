import type { CSSProperties } from "react";

import { COLORS } from "@/lib/bill-uploader/constants";

type FilterChipsProps = {
  categories: string[];
  filterCategory: string;
  onSelect: (name: string) => void;
};

function chipStyle(active: boolean): CSSProperties {
  return {
    flex: "none",
    padding: "8px 15px",
    borderRadius: "100px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: `1.5px solid ${active ? COLORS.primary : COLORS.border}`,
    background: active ? COLORS.primary : "#fff",
    color: active ? "#fff" : COLORS.textMuted,
  };
}

export function FilterChips({ categories, filterCategory, onSelect }: FilterChipsProps) {
  const chips = ["All", ...categories];

  return (
    <div className="-mx-5 mb-1.5 flex gap-2 overflow-x-auto px-5 pb-3.5">
      {chips.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          style={chipStyle(filterCategory === name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
