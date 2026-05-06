import { useCallback, useEffect, useRef, useState } from "react";

import type { ToastPayload, ToastType } from "../components/Toast";

export function useToast() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      clearTimer();
      setToast({
        id: Date.now(),
        message,
        type,
      });
      timeoutRef.current = window.setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, 3_000);
    },
    [clearTimer],
  );

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { toast, showToast };
}
