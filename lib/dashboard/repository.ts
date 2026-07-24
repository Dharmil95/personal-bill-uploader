import { queryPostgres } from "@/lib/db/postgres";
import { buildDayDetail } from "@/lib/dashboard/day";
import type { RecentOwnerFilter } from "@/lib/bill-uploader/types";
import type {
  DriveFileRow,
  ExpenseLineItemRow,
  ExpenseRow,
  ExpenseSource,
  ProcessStatus,
  ReviewStatus,
} from "@/lib/supabase/types";
import { createSupabaseServerClient, hasSupabaseServiceRoleConfig } from "@/lib/supabase/server";

type ExpenseSummaryRow = Pick<
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

type DriveFileLinkRow = Pick<
  DriveFileRow,
  "drive_file_id" | "process_status" | "web_view_link" | "review_status"
>;

function parseNumeric(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function mapExpenseSummaryRow(row: Record<string, unknown>): ExpenseSummaryRow {
  return {
    id: String(row.id),
    drive_file_id: String(row.drive_file_id),
    owner: row.owner as ExpenseSummaryRow["owner"],
    category: String(row.category),
    vendor: row.vendor == null ? null : String(row.vendor),
    amount: parseNumeric(row.amount),
    currency: String(row.currency ?? "INR"),
    bill_date: row.bill_date == null ? null : String(row.bill_date),
    created_at: String(row.created_at),
  };
}

function mapExpenseRow(row: Record<string, unknown>): ExpenseRow {
  return {
    id: String(row.id),
    drive_file_id: String(row.drive_file_id),
    owner: row.owner as ExpenseRow["owner"],
    category: String(row.category),
    vendor: row.vendor == null ? null : String(row.vendor),
    amount: parseNumeric(row.amount),
    currency: String(row.currency ?? "INR"),
    bill_date: row.bill_date == null ? null : String(row.bill_date),
    confidence: parseNumeric(row.confidence),
    raw_llm_json: (row.raw_llm_json as Record<string, unknown> | null) ?? null,
    invoice_number: row.invoice_number == null ? null : String(row.invoice_number),
    subtotal: parseNumeric(row.subtotal),
    discount: parseNumeric(row.discount),
    delivery_fee: parseNumeric(row.delivery_fee),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapLineItemRow(row: Record<string, unknown>): ExpenseLineItemRow {
  return {
    id: String(row.id),
    expense_id: String(row.expense_id),
    drive_file_id: String(row.drive_file_id),
    line_no: Number(row.line_no),
    description: String(row.description),
    quantity: parseNumeric(row.quantity),
    unit: row.unit == null ? null : String(row.unit),
    rate: parseNumeric(row.rate),
    amount: parseNumeric(row.amount),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function extractSmsText(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const smsText = raw.sms_text;
  if (typeof smsText === "string" && smsText.trim()) {
    return smsText.trim();
  }

  return null;
}

function mapDriveFileLinkRow(row: Record<string, unknown>): DriveFileLinkRow {
  return {
    drive_file_id: String(row.drive_file_id),
    process_status: row.process_status as ProcessStatus,
    web_view_link: row.web_view_link == null ? null : String(row.web_view_link),
    review_status: (row.review_status as ReviewStatus | undefined) ?? "active",
  };
}

async function fetchDashboardSummaryDataViaSupabase() {
  const supabase = createSupabaseServerClient();

  const [expensesResult, driveFilesResult, lineItemsResult] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, drive_file_id, owner, category, vendor, amount, currency, bill_date, created_at",
      )
      .order("bill_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("drive_files").select("drive_file_id, process_status, web_view_link, review_status"),
    supabase.from("expense_line_items").select("expense_id"),
  ]);

  if (expensesResult.error) {
    throw new Error(expensesResult.error.message);
  }

  if (driveFilesResult.error) {
    throw new Error(driveFilesResult.error.message);
  }

  if (lineItemsResult.error) {
    throw new Error(lineItemsResult.error.message);
  }

  const lineItemCounts: Record<string, number> = {};
  for (const row of lineItemsResult.data ?? []) {
    lineItemCounts[row.expense_id] = (lineItemCounts[row.expense_id] ?? 0) + 1;
  }

  return {
    expenses: expensesResult.data ?? [],
    driveFiles: driveFilesResult.data ?? [],
    lineItemCounts,
  };
}

async function fetchDashboardSummaryDataViaPostgres() {
  const [expenses, driveFiles, lineItems] = await Promise.all([
    queryPostgres(
      `
        select id, drive_file_id, owner, category, vendor, amount, currency, bill_date, created_at
        from public.expenses
        order by bill_date desc nulls last, created_at desc
      `,
    ),
    queryPostgres(
      `
        select drive_file_id, process_status, web_view_link, review_status
        from public.drive_files
      `,
    ),
    queryPostgres(`select expense_id from public.expense_line_items`),
  ]);

  const lineItemCounts: Record<string, number> = {};
  for (const row of lineItems) {
    const expenseId = String(row.expense_id);
    lineItemCounts[expenseId] = (lineItemCounts[expenseId] ?? 0) + 1;
  }

  return {
    expenses: expenses.map(mapExpenseSummaryRow),
    driveFiles: driveFiles.map(mapDriveFileLinkRow),
    lineItemCounts,
  };
}

export async function fetchDashboardSummaryData() {
  if (hasSupabaseServiceRoleConfig()) {
    return fetchDashboardSummaryDataViaSupabase();
  }

  return fetchDashboardSummaryDataViaPostgres();
}

async function fetchExpenseDetailViaSupabase(id: string) {
  const supabase = createSupabaseServerClient();

  const expenseResult = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();

  if (expenseResult.error) {
    throw new Error(expenseResult.error.message);
  }

  if (!expenseResult.data) {
    return null;
  }

  const expense = expenseResult.data;

  const [lineItemsResult, driveFileResult] = await Promise.all([
    supabase
      .from("expense_line_items")
      .select("*")
      .eq("expense_id", id)
      .order("line_no", { ascending: true }),
    supabase
      .from("drive_files")
      .select("web_view_link, filename, review_status, source")
      .eq("drive_file_id", expense.drive_file_id)
      .maybeSingle(),
  ]);

  if (lineItemsResult.error) {
    throw new Error(lineItemsResult.error.message);
  }

  if (driveFileResult.error) {
    throw new Error(driveFileResult.error.message);
  }

  return {
    expense,
    lineItems: lineItemsResult.data ?? [],
    webViewLink: driveFileResult.data?.web_view_link ?? null,
    filename: driveFileResult.data?.filename ?? null,
    reviewStatus: driveFileResult.data?.review_status ?? "active",
    source: (driveFileResult.data?.source as ExpenseSource | undefined) ?? "drive",
    smsText: extractSmsText(expense.raw_llm_json),
  };
}

async function fetchExpenseDetailViaPostgres(id: string) {
  const expenseRows = await queryPostgres(
    `
      select *
      from public.expenses
      where id = $1
      limit 1
    `,
    [id],
  );

  if (expenseRows.length === 0) {
    return null;
  }

  const expense = mapExpenseRow(expenseRows[0]);

  const [lineItemRows, driveFileRows] = await Promise.all([
    queryPostgres(
      `
        select *
        from public.expense_line_items
        where expense_id = $1
        order by line_no asc
      `,
      [id],
    ),
    queryPostgres(
      `
        select web_view_link, filename, review_status, source
        from public.drive_files
        where drive_file_id = $1
        limit 1
      `,
      [expense.drive_file_id],
    ),
  ]);

  return {
    expense,
    lineItems: lineItemRows.map(mapLineItemRow),
    webViewLink:
      driveFileRows[0]?.web_view_link == null ? null : String(driveFileRows[0].web_view_link),
    filename: driveFileRows[0]?.filename == null ? null : String(driveFileRows[0].filename),
    reviewStatus: (driveFileRows[0]?.review_status as ReviewStatus | undefined) ?? "active",
    source: (driveFileRows[0]?.source as ExpenseSource | undefined) ?? "drive",
    smsText: extractSmsText(expense.raw_llm_json),
  };
}

export async function fetchExpenseDetail(id: string) {
  if (hasSupabaseServiceRoleConfig()) {
    return fetchExpenseDetailViaSupabase(id);
  }

  return fetchExpenseDetailViaPostgres(id);
}

async function fetchDayDetailViaSupabase(date: string, ownerFilter: RecentOwnerFilter) {
  const { expenses, driveFiles, lineItemCounts } = await fetchDashboardSummaryDataViaSupabase();

  return buildDayDetail({
    date,
    ownerFilter,
    expenses: (expenses ?? []).map((row) => ({
      id: String(row.id),
      drive_file_id: String(row.drive_file_id),
      owner: row.owner as ExpenseSummaryRow["owner"],
      category: String(row.category),
      vendor: row.vendor == null ? null : String(row.vendor),
      amount: parseNumeric(row.amount),
      currency: String(row.currency ?? "INR"),
      bill_date: row.bill_date == null ? null : String(row.bill_date),
      created_at: String(row.created_at),
    })),
    driveFiles: (driveFiles ?? []).map((row) => ({
      drive_file_id: String(row.drive_file_id),
      web_view_link: row.web_view_link == null ? null : String(row.web_view_link),
      review_status: (row.review_status as ReviewStatus | undefined) ?? "active",
    })),
    lineItemCounts,
  });
}

async function fetchDayDetailViaPostgres(date: string, ownerFilter: RecentOwnerFilter) {
  const ownerClause =
    ownerFilter === "everyone" ? "" : "and e.owner = $2";

  const params = ownerFilter === "everyone" ? [date] : [date, ownerFilter];

  const expenseRows = await queryPostgres(
    `
      select e.id, e.drive_file_id, e.owner, e.category, e.vendor, e.amount, e.currency,
             e.bill_date, e.created_at,
             df.web_view_link, coalesce(df.review_status, 'active') as review_status
      from public.expenses e
      left join public.drive_files df on df.drive_file_id = e.drive_file_id
      where coalesce(df.review_status, 'active') = 'active'
        and (
          (e.bill_date is not null and e.bill_date = $1::date)
          or (e.bill_date is null and (e.created_at at time zone 'utc')::date = $1::date)
        )
        ${ownerClause}
      order by e.amount desc nulls last, e.created_at desc
    `,
    params,
  );

  const lineItemCounts: Record<string, number> = {};
  if (expenseRows.length > 0) {
    const expenseIds = expenseRows.map((row) => String(row.id));
    const lineItemRows = await queryPostgres(
      `
        select expense_id
        from public.expense_line_items
        where expense_id = any($1::uuid[])
      `,
      [expenseIds],
    );

    for (const row of lineItemRows) {
      const expenseId = String(row.expense_id);
      lineItemCounts[expenseId] = (lineItemCounts[expenseId] ?? 0) + 1;
    }
  }

  return buildDayDetail({
    date,
    ownerFilter,
    expenses: expenseRows.map((row) => ({
      id: String(row.id),
      drive_file_id: String(row.drive_file_id),
      owner: row.owner as ExpenseSummaryRow["owner"],
      category: String(row.category),
      vendor: row.vendor == null ? null : String(row.vendor),
      amount: parseNumeric(row.amount),
      currency: String(row.currency ?? "INR"),
      bill_date: row.bill_date == null ? null : String(row.bill_date),
      created_at: String(row.created_at),
    })),
    driveFiles: expenseRows.map((row) => ({
      drive_file_id: String(row.drive_file_id),
      web_view_link: row.web_view_link == null ? null : String(row.web_view_link),
      review_status: (row.review_status as ReviewStatus | undefined) ?? "active",
    })),
    lineItemCounts,
  });
}

export async function fetchDayDetail(date: string, ownerFilter: RecentOwnerFilter) {
  if (hasSupabaseServiceRoleConfig()) {
    return fetchDayDetailViaSupabase(date, ownerFilter);
  }

  return fetchDayDetailViaPostgres(date, ownerFilter);
}
