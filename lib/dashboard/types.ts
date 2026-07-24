import type { ExpenseLineItemRow, ExpenseRow, ExpenseSource, ReviewStatus } from "@/lib/supabase/types";
import type { ExpenseOwner, RecentOwnerFilter } from "@/lib/bill-uploader/types";

export type DashboardBillSummary = {
  id: string;
  driveFileId: string;
  vendor: string | null;
  category: string;
  owner: ExpenseOwner;
  amount: number | null;
  currency: string;
  billDate: string | null;
  webViewLink: string | null;
  lineItemCount: number;
  reviewStatus: ReviewStatus;
};

export type DashboardCategorySpend = {
  category: string;
  amount: number;
  count: number;
};

export type DashboardVendorSpend = {
  vendor: string;
  amount: number;
  count: number;
};

export type DashboardDailySpend = {
  date: string;
  amount: number;
  count: number;
};

export type DashboardDayDetail = {
  date: string;
  ownerFilter: RecentOwnerFilter;
  currency: string;
  totalSpend: number;
  billCount: number;
  bills: DashboardBillSummary[];
};

export type DashboardProcessStatus = {
  pending: number;
  processing: number;
  done: number;
  failed: number;
};

export type DashboardSummary = {
  currency: string;
  ownerFilter: RecentOwnerFilter;
  totalSpend: number;
  monthSpend: number;
  lastMonthSpend: number;
  monthChangePct: number | null;
  billCount: number;
  monthBillCount: number;
  avgBillAmount: number | null;
  byOwner: { me: number; parents: number };
  byCategory: DashboardCategorySpend[];
  topVendors: DashboardVendorSpend[];
  dailySpend: DashboardDailySpend[];
  bills: DashboardBillSummary[];
  processStatus: DashboardProcessStatus;
};

export type DashboardExpenseDetail = {
  expense: ExpenseRow;
  lineItems: ExpenseLineItemRow[];
  webViewLink: string | null;
  filename: string | null;
  reviewStatus: ReviewStatus;
  source: ExpenseSource;
  smsText: string | null;
};
