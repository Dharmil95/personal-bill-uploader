export function formatInrAmount(amount: number | null | undefined, currency = "INR"): string {
  if (amount == null || Number.isNaN(amount)) {
    return "—";
  }

  const hasDecimals = Math.abs(amount % 1) > 0.001;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: hasDecimals ? 2 : 0,
    minimumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
}

export function formatBillDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthChangePct(pct: number | null): string {
  if (pct == null) {
    return "";
  }

  const rounded = Math.round(pct);
  const arrow = rounded > 0 ? "↑" : rounded < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(rounded)}% vs last month`;
}
