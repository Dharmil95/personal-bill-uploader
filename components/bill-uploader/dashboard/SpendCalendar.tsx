"use client";

import { useState } from "react";

import { COLORS } from "@/lib/bill-uploader/constants";
import { formatInrAmount } from "@/lib/dashboard/format";
import type { DashboardDailySpend } from "@/lib/dashboard/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function initialMonth(spend: DashboardDailySpend[]): Date {
  const now = new Date();
  const currentKey = monthKey(now.getFullYear(), now.getMonth());
  const hasCurrentMonth = spend.some((day) => day.date.startsWith(currentKey));

  if (hasCurrentMonth || spend.length === 0) {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const latest = spend[spend.length - 1].date;
  const [year, month] = latest.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function formatCompactAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

type SpendCalendarProps = {
  spend: DashboardDailySpend[];
  currency: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange?: () => void;
};

export function SpendCalendar({
  spend,
  currency,
  selectedDate,
  onSelectDate,
  onMonthChange,
}: SpendCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => initialMonth(spend));
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const visibleKey = monthKey(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = new Date(year, month, 1).getDay();
  const today = new Date();

  const spendByDate = new Map(spend.map((day) => [day.date, day]));
  const monthSpend = spend.filter((day) => day.date.startsWith(visibleKey));
  const monthTotal = monthSpend.reduce((total, day) => total + day.amount, 0);
  const maxDailyAmount = Math.max(0, ...monthSpend.map((day) => day.amount));
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;

  const moveMonth = (offset: number) => {
    onMonthChange?.();
    setVisibleMonth((current) => {
      return new Date(current.getFullYear(), current.getMonth() + offset, 1);
    });
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: COLORS.text }}>
            Spend calendar
          </div>
          <div className="text-[11.5px]" style={{ color: COLORS.textSubtle }}>
            {formatInrAmount(monthTotal, currency)} this month
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ color: COLORS.primary }}
          >
            ‹
          </button>
          <div
            className="min-w-[112px] text-center text-[12.5px] font-semibold"
            style={{ color: COLORS.text }}
          >
            {visibleMonth.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ color: COLORS.primary }}
          >
            ›
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-black/[0.07] bg-white p-2">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="pb-1.5 text-center text-[9.5px] font-semibold uppercase"
              style={{ color: COLORS.textSubtle }}
            >
              {weekday}
            </div>
          ))}

          {Array.from({ length: cellCount }, (_, index) => {
            const dayNumber = index - leadingDays + 1;
            if (dayNumber < 1 || dayNumber > daysInMonth) {
              return <div key={`empty-${index}`} className="h-[52px]" aria-hidden="true" />;
            }

            const date = `${visibleKey}-${String(dayNumber).padStart(2, "0")}`;
            const daySpend = spendByDate.get(date);
            const intensity =
              daySpend && maxDailyAmount > 0
                ? 0.12 + (daySpend.amount / maxDailyAmount) * 0.3
                : 0;
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === dayNumber;
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDate(date)}
                title={
                  daySpend
                    ? `${daySpend.count} expense${daySpend.count === 1 ? "" : "s"} · ${formatInrAmount(daySpend.amount, currency)}`
                    : "No spend"
                }
                className="flex h-[52px] min-w-0 flex-col items-center rounded-[9px] px-0.5 pt-1"
                style={{
                  background: daySpend
                    ? `rgba(0, 105, 92, ${intensity})`
                    : "transparent",
                  outline: isSelected
                    ? `2px solid ${COLORS.primaryDark}`
                    : isToday
                      ? `1.5px solid ${COLORS.primary}`
                      : "none",
                  outlineOffset: "-2px",
                }}
              >
                <span
                  className="text-[10.5px] font-medium"
                  style={{ color: daySpend ? COLORS.primaryDark : COLORS.textMuted }}
                >
                  {dayNumber}
                </span>
                {daySpend ? (
                  <span
                    className="mt-1 max-w-full truncate text-[8.5px] font-semibold"
                    style={{ color: COLORS.primaryDark }}
                  >
                    {formatCompactAmount(daySpend.amount, currency)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
