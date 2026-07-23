import type { ExpenseOwner, RecentOwnerFilter } from "./types";

export const SEED_CATEGORIES = [
  "Groceries",
  "Vegetables & Fruits",
  "Electricity",
  "Rent",
  "Internet",
  "Insurance",
] as const;

export const EXPENSE_OWNERS: ExpenseOwner[] = ["me", "parents"];

export const OWNER_FOLDER_NAMES: Record<ExpenseOwner, string> = {
  me: "Me",
  parents: "Parents",
};

export const OWNER_LABELS: Record<ExpenseOwner, string> = {
  me: "Me",
  parents: "Parents",
};

export const DEFAULT_EXPENSE_OWNER: ExpenseOwner = "me";

export const RECENT_OWNER_FILTERS: RecentOwnerFilter[] = ["me", "parents", "everyone"];

export const RECENT_OWNER_FILTER_LABELS: Record<RecentOwnerFilter, string> = {
  me: "Me",
  parents: "Parents",
  everyone: "Everyone",
};

export const DEFAULT_RECENT_OWNER_FILTER: RecentOwnerFilter = "me";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const TOAST_DURATION_MS = 2600;

export const COLORS = {
  pageBg: "#eef2f0",
  shellBg: "#f7faf9",
  primary: "#00695c",
  primaryDark: "#00392f",
  primaryLight: "#e5f4f0",
  primaryMuted: "#cde8e1",
  text: "#1a1c1b",
  textMuted: "#49454f",
  textSubtle: "#8a978f",
  border: "#d7e1dd",
  borderLight: "#b8c4c0",
  disabledBg: "#dbe4e0",
  pdf: "#d64545",
  toastBg: "#1a1c1b",
  toastAccent: "#6fe3c4",
  progressTrack: "#e0e8e5",
  progressRing: "#cfe3de",
} as const;
