import type { RecentItem } from "./types";

export const SEED_CATEGORIES = [
  "Groceries",
  "Vegetables & Fruits",
  "Electricity",
  "Rent",
  "Internet",
  "Insurance",
] as const;

export const SEED_RECENT: RecentItem[] = [
  {
    id: "seed1",
    filename: "groceries_2026-07-22_jiomart-order.jpg",
    category: "Groceries",
    fileType: "image",
    thumb: "/seed/jiomart-order.jpg",
    uploadedAt: "Yesterday, 6:40 PM",
  },
  {
    id: "seed2",
    filename: "vegetables-fruits_2026-07-23_invoice.jpg",
    category: "Vegetables & Fruits",
    fileType: "image",
    thumb: "/seed/vegetables-invoice.jpeg",
    uploadedAt: "Today, 9:14 AM",
  },
];

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
