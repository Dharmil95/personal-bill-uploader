import type { ExpenseRow, ProcessStatus, ReviewStatus } from "@/lib/supabase/types";
import type { RecentOwnerFilter } from "@/lib/bill-uploader/types";

import { expenseDateKey } from "./date";
import type {
  DashboardBillSummary,
  DashboardCategorySpend,
  DashboardDailySpend,
  DashboardProcessStatus,
  DashboardSummary,
  DashboardVendorSpend,
} from "./types";

type DriveFileLink = {
  drive_file_id: string;
  process_status: ProcessStatus;
  web_view_link: string | null;
  review_status: ReviewStatus;
};

type ExpenseWithAmount = Pick<
  ExpenseRow,
  | "id"
  | "drive_file_id"
  | "owner"
  | "category"
  | "vendor"
  | "amount"
  | "currency"
  | "bill_date"
  | "created_at"
>;

function expenseSortKey(expense: ExpenseWithAmount): number {
  const dateValue = expense.bill_date ?? expense.created_at;
  return new Date(dateValue).getTime();
}

function expenseEffectiveDate(expense: ExpenseWithAmount): Date {
  return new Date(expense.bill_date ?? expense.created_at);
}

function monthBounds(reference = new Date()) {
  const thisMonthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const lastMonthStart = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return { thisMonthStart, lastMonthStart };
}

function isInMonth(date: Date, monthStart: Date): boolean {
  const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  return date >= monthStart && date < nextMonthStart;
}

function sumAmounts(expenses: ExpenseWithAmount[]): number {
  return expenses.reduce((total, expense) => total + (expense.amount ?? 0), 0);
}

export function buildDashboardSummary(params: {
  ownerFilter: RecentOwnerFilter;
  expenses: ExpenseWithAmount[];
  driveFiles: DriveFileLink[];
  lineItemCounts: Record<string, number>;
  billsLimit?: number;
}): DashboardSummary {
  const { ownerFilter, expenses, driveFiles, lineItemCounts, billsLimit = 25 } = params;
  const linkByDriveId = new Map(
    driveFiles.map((file) => [file.drive_file_id, file.web_view_link]),
  );
  const reviewStatusByDriveId = new Map(
    driveFiles.map((file) => [file.drive_file_id, file.review_status]),
  );

  const getReviewStatus = (driveFileId: string): ReviewStatus =>
    reviewStatusByDriveId.get(driveFileId) ?? "active";

  const isActiveExpense = (expense: ExpenseWithAmount) =>
    getReviewStatus(expense.drive_file_id) === "active";

  const filtered =
    ownerFilter === "everyone"
      ? expenses
      : expenses.filter((expense) => expense.owner === ownerFilter);

  const activeFiltered = filtered.filter(isActiveExpense);
  const activeExpenses = expenses.filter(isActiveExpense);

  const { thisMonthStart, lastMonthStart } = monthBounds();
  const thisMonthExpenses = activeFiltered.filter((expense) =>
    isInMonth(expenseEffectiveDate(expense), thisMonthStart),
  );
  const lastMonthExpenses = activeFiltered.filter((expense) =>
    isInMonth(expenseEffectiveDate(expense), lastMonthStart),
  );

  const totalSpend = sumAmounts(activeFiltered);
  const monthSpend = sumAmounts(thisMonthExpenses);
  const lastMonthSpend = sumAmounts(lastMonthExpenses);
  const billCount = activeFiltered.length;
  const monthBillCount = thisMonthExpenses.length;
  const avgBillAmount = billCount > 0 ? totalSpend / billCount : null;
  const monthChangePct =
    lastMonthSpend > 0 ? ((monthSpend - lastMonthSpend) / lastMonthSpend) * 100 : null;

  const byOwner = {
    me: sumAmounts(activeExpenses.filter((expense) => expense.owner === "me")),
    parents: sumAmounts(activeExpenses.filter((expense) => expense.owner === "parents")),
  };

  const categoryMap = new Map<string, { amount: number; count: number }>();
  for (const expense of activeFiltered) {
    const current = categoryMap.get(expense.category) ?? { amount: 0, count: 0 };
    categoryMap.set(expense.category, {
      amount: current.amount + (expense.amount ?? 0),
      count: current.count + 1,
    });
  }

  const byCategory: DashboardCategorySpend[] = [...categoryMap.entries()]
    .map(([category, stats]) => ({ category, ...stats }))
    .sort((a, b) => b.amount - a.amount);

  const vendorMap = new Map<string, { amount: number; count: number }>();
  for (const expense of activeFiltered) {
    const vendor = expense.vendor?.trim();
    if (!vendor) {
      continue;
    }

    const current = vendorMap.get(vendor) ?? { amount: 0, count: 0 };
    vendorMap.set(vendor, {
      amount: current.amount + (expense.amount ?? 0),
      count: current.count + 1,
    });
  }

  const topVendors: DashboardVendorSpend[] = [...vendorMap.entries()]
    .map(([vendor, stats]) => ({ vendor, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const dailySpendMap = new Map<string, { amount: number; count: number }>();
  for (const expense of activeFiltered) {
    const date = expenseDateKey(expense);
    if (!date) {
      continue;
    }
    const current = dailySpendMap.get(date) ?? { amount: 0, count: 0 };
    dailySpendMap.set(date, {
      amount: current.amount + (expense.amount ?? 0),
      count: current.count + 1,
    });
  }

  const dailySpend: DashboardDailySpend[] = [...dailySpendMap.entries()]
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const bills: DashboardBillSummary[] = [...filtered]
    .sort((a, b) => expenseSortKey(b) - expenseSortKey(a))
    .slice(0, billsLimit)
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

  const processStatus: DashboardProcessStatus = {
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
  };

  for (const file of driveFiles) {
    if (file.process_status === "pending") {
      processStatus.pending += 1;
    } else if (file.process_status === "processing") {
      processStatus.processing += 1;
    } else if (file.process_status === "done") {
      processStatus.done += 1;
    } else if (file.process_status === "failed") {
      processStatus.failed += 1;
    }
  }

  return {
    currency: activeFiltered[0]?.currency ?? filtered[0]?.currency ?? expenses[0]?.currency ?? "INR",
    ownerFilter,
    totalSpend,
    monthSpend,
    lastMonthSpend,
    monthChangePct,
    billCount,
    monthBillCount,
    avgBillAmount,
    byOwner,
    byCategory,
    topVendors,
    dailySpend,
    bills,
    processStatus,
  };
}
