import type { RecentItem } from "@/lib/bill-uploader/types";

import { FilterChips } from "./FilterChips";
import { RecentItemRow } from "./RecentItemRow";

type RecentTabProps = {
  categories: string[];
  filterCategory: string;
  items: RecentItem[];
  onFilterChange: (category: string) => void;
  onOpenItem: (item: RecentItem) => void;
};

export function RecentTab({
  categories,
  filterCategory,
  items,
  onFilterChange,
  onOpenItem,
}: RecentTabProps) {
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
      <FilterChips
        categories={categories}
        filterCategory={filterCategory}
        onSelect={onFilterChange}
      />
      {items.length > 0 ? (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <RecentItemRow key={item.id} item={item} onOpen={onOpenItem} />
          ))}
        </div>
      ) : (
        <div
          className="px-5 py-[60px] text-center text-[13.5px]"
          style={{ color: "#8a978f" }}
        >
          No uploads in this category yet.
        </div>
      )}
    </div>
  );
}
