import type { CSSProperties } from "react";

import {
  COLORS,
  RECENT_OWNER_FILTER_LABELS,
  RECENT_OWNER_FILTERS,
} from "@/lib/bill-uploader/constants";
import type { RecentOwnerFilter } from "@/lib/bill-uploader/types";

type OwnerFilterChipsProps = {
  filterOwner: RecentOwnerFilter;
  onSelect: (owner: RecentOwnerFilter) => void;
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

export function OwnerFilterChips({ filterOwner, onSelect }: OwnerFilterChipsProps) {
  return (
    <div className="-mx-5 mb-1 flex gap-2 overflow-x-auto px-5 pb-3">
      {RECENT_OWNER_FILTERS.map((owner) => (
        <button
          key={owner}
          type="button"
          onClick={() => onSelect(owner)}
          style={chipStyle(filterOwner === owner)}
        >
          {RECENT_OWNER_FILTER_LABELS[owner]}
        </button>
      ))}
    </div>
  );
}
