"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { TOAST_DURATION_MS } from "@/lib/bill-uploader/constants";
import type { ToastState } from "@/lib/bill-uploader/types";

const HIDDEN_TOAST: ToastState = { visible: false, message: "" };

export function useToast() {
  const [toast, setToast] = useState<ToastState>(HIDDEN_TOAST);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string) => {
      clearTimer();
      setToast({ visible: true, message });
      timerRef.current = window.setTimeout(() => {
        setToast(HIDDEN_TOAST);
        timerRef.current = null;
      }, TOAST_DURATION_MS);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { toast, showToast };
}
