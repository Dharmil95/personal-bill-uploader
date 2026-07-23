"use client";

import { useEffect, useState } from "react";

import { COLORS, OWNER_LABELS } from "@/lib/bill-uploader/constants";
import { formatBillDate, formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardExpenseDetail } from "@/lib/dashboard/types";

type BillDetailSheetProps = {
  expenseId: string;
  onBack: () => void;
  onError: (message: string) => void;
};

function MoneyRow({ label, amount, currency }: { label: string; amount: number | null; currency: string }) {
  if (amount == null) {
    return null;
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span className="font-medium" style={{ color: COLORS.text }}>
        {formatInrAmount(amount, currency)}
      </span>
    </div>
  );
}

export function BillDetailSheet({ expenseId, onBack, onError }: BillDetailSheetProps) {
  const [detail, setDetail] = useState<DashboardExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      try {
        const response = await fetch(`/api/dashboard/expenses/${expenseId}`);
        const data = (await response.json()) as DashboardExpenseDetail & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load bill detail");
        }

        if (!cancelled) {
          setDetail(data);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load bill detail";
          onError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [expenseId, onError]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 pb-5 text-[13.5px]" style={{ color: COLORS.textSubtle }}>
        Loading bill…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-5">
        <div className="text-[13.5px]" style={{ color: COLORS.textSubtle }}>
          Could not load this bill.
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-4 py-2 text-[13px] font-semibold"
          style={{ background: COLORS.primaryLight, color: COLORS.primary }}
        >
          Back
        </button>
      </div>
    );
  }

  const { expense, lineItems, webViewLink, filename } = detail;
  const title = expense.vendor?.trim() || expense.category;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-center gap-2 px-5 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-2 py-1 text-[20px] leading-none"
          style={{ color: COLORS.primary }}
          aria-label="Back to dashboard"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold" style={{ color: COLORS.text }}>
            {title}
          </div>
          {filename ? (
            <div className="truncate text-[12px]" style={{ color: COLORS.textSubtle }}>
              {filename}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="rounded-[14px] border border-black/[0.07] bg-white p-4">
          <div className="text-[24px] font-semibold tracking-[-0.4px]" style={{ color: COLORS.primaryDark }}>
            {formatInrAmount(expense.amount, expense.currency)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: COLORS.primaryMuted, color: COLORS.primaryDark }}
            >
              {OWNER_LABELS[expense.owner]}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: COLORS.primaryLight, color: COLORS.primary }}
            >
              {expense.category}
            </span>
            <span className="text-[12px]" style={{ color: COLORS.textSubtle }}>
              {formatBillDate(expense.bill_date)}
            </span>
          </div>
          {expense.invoice_number ? (
            <div className="mt-3 text-[12.5px]" style={{ color: COLORS.textMuted }}>
              Invoice #{expense.invoice_number}
            </div>
          ) : null}
        </div>

        {expense.subtotal != null || expense.discount != null || expense.delivery_fee != null ? (
          <div className="mt-3 rounded-[14px] border border-black/[0.07] bg-white px-4 py-2">
            <MoneyRow label="Subtotal" amount={expense.subtotal} currency={expense.currency} />
            <MoneyRow label="Discount" amount={expense.discount} currency={expense.currency} />
            <MoneyRow label="Delivery" amount={expense.delivery_fee} currency={expense.currency} />
            <div className="mt-1 border-t border-black/[0.06] pt-2">
              <MoneyRow label="Grand total" amount={expense.amount} currency={expense.currency} />
            </div>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
            Line items
          </div>
          {lineItems.length === 0 ? (
            <div
              className="rounded-[12px] border border-dashed px-4 py-6 text-center text-[13px]"
              style={{ borderColor: COLORS.border, color: COLORS.textSubtle }}
            >
              No line items extracted
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[12px] border border-black/[0.06] bg-white px-3 py-2.5"
                >
                  <div className="text-[13px] font-medium" style={{ color: COLORS.text }}>
                    {item.description}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                    <span style={{ color: COLORS.textSubtle }}>
                      {item.quantity != null ? item.quantity : "—"}
                      {item.unit ? ` ${item.unit}` : ""}
                      {item.rate != null ? ` · ${formatInrAmount(item.rate, expense.currency)}` : ""}
                    </span>
                    <span className="font-semibold" style={{ color: COLORS.primaryDark }}>
                      {formatInrAmount(item.amount, expense.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <button
            type="button"
            disabled={!webViewLink}
            onClick={() => {
              if (webViewLink) {
                window.open(webViewLink, "_blank", "noopener,noreferrer");
              }
            }}
            className="w-full rounded-[12px] px-4 py-3 text-[13.5px] font-semibold disabled:cursor-not-allowed"
            style={{
              background: webViewLink ? COLORS.primary : COLORS.disabledBg,
              color: webViewLink ? "#fff" : COLORS.textSubtle,
            }}
          >
            Open original
          </button>
        </div>
      </div>
    </div>
  );
}
