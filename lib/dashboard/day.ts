import type { ReviewStatus } from "@/lib/supabase/types";
import type { RecentOwnerFilter } from "@/lib/bill-uploader/types";

import { expenseDateKey } from "./date";
import type { DashboardBillSummary, DashboardDayDetail } from "./types";

type ExpenseRow = {
  id: string;
  drive_file_id: string;
  owner: DashboardBillSummary["owner"];
  category: string;
  vendor: string | null;
  amount: number | null;
  currency: string;
  bill_date: string | null;
  created_at: string;
};

type DriveFileLink = {
  drive_file_id: string;
  web_view_link: string | null;
  review_status: ReviewStatus;
};

export function buildDayDetail(params: {
  date: string;
  ownerFilter: RecentOwnerFilter;
  expenses: ExpenseRow[];
  driveFiles: DriveFileLink[];
  lineItemCounts: Record<string, number>;
}): DashboardDayDetail {
  const { date, ownerFilter, expenses, driveFiles, lineItemCounts } = params;

  const linkByDriveId = new Map(
    driveFiles.map((file) => [file.drive_file_id, file.web_view_link]),
  );
  const reviewStatusByDriveId = new Map(
    driveFiles.map((file) => [file.drive_file_id, file.review_status]),
  );

  const getReviewStatus = (driveFileId: string): ReviewStatus =>
    reviewStatusByDriveId.get(driveFileId) ?? "active";

  const ownerFiltered =
    ownerFilter === "everyone"
      ? expenses
      : expenses.filter((expense) => expense.owner === ownerFilter);

  const dayExpenses = ownerFiltered.filter((expense) => {
    if (expenseDateKey(expense) !== date) {
      return false;
    }

    return getReviewStatus(expense.drive_file_id) === "active";
  });

  const bills: DashboardBillSummary[] = dayExpenses
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .map((expense) => ({
      id: expense.id,
      driveFileId: expense.drive_file_id,
      vendor: expense.vendor,
      category: expense.category,
      owner: expense.owner,
      amount: expense.amount,
      currency: expense.currency,
      billDate: expense.bill_date,
      webViewLink: linkByDriveId.get(expense.drive_file_id) ?? null,
      lineItemCount: lineItemCounts[expense.id] ?? 0,
      reviewStatus: getReviewStatus(expense.drive_file_id),
    }));

  const totalSpend = bills.reduce((total, bill) => total + (bill.amount ?? 0), 0);
  const currency = bills[0]?.currency ?? ownerFiltered[0]?.currency ?? expenses[0]?.currency ?? "INR";

  return {
    date,
    ownerFilter,
    currency,
    totalSpend,
    billCount: bills.length,
    bills,
  };
}
