type ExpenseDateInput = {
  bill_date: string | null;
  created_at: string;
};

export function expenseDateKey(expense: ExpenseDateInput): string {
  const value = expense.bill_date ?? expense.created_at;
  const isoMatch = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
