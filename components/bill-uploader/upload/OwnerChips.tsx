import type { CSSProperties } from "react";

import { COLORS, EXPENSE_OWNERS, OWNER_LABELS } from "@/lib/bill-uploader/constants";
import type { ExpenseOwner } from "@/lib/bill-uploader/types";

type OwnerChipsProps = {
  selectedOwner: ExpenseOwner;
  onSelectOwner: (owner: ExpenseOwner) => void;
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

export function OwnerChips({ selectedOwner, onSelectOwner }: OwnerChipsProps) {
  return (
    <>
      <div className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[#49454f]">
        For
      </div>
      <div className="mb-3.5 flex flex-wrap gap-2">
        {EXPENSE_OWNERS.map((owner) => (
          <button
            key={owner}
            type="button"
            onClick={() => onSelectOwner(owner)}
            style={chipStyle(selectedOwner === owner)}
          >
            {OWNER_LABELS[owner]}
          </button>
        ))}
      </div>
    </>
  );
}
