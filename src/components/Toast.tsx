import { Check, Sparkles, X } from "lucide-react";

import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "info";

export interface ToastPayload {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastPayload | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) {
    return null;
  }

  const icon =
    toast.type === "success" ? (
      <Check size={16} strokeWidth={1.75} />
    ) : toast.type === "error" ? (
      <X size={16} strokeWidth={1.75} />
    ) : (
      <Sparkles size={16} strokeWidth={1.75} />
    );

  return (
    <div
      aria-live="polite"
      className={`${styles.toast} ${styles[toast.type]}`}
      key={toast.id}
      role="status"
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.message}>{toast.message}</span>
    </div>
  );
}
