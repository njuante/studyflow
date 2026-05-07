import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";

export function useTaskbarBadge(pendingCount: number) {
  useEffect(() => {
    if (!isTauri()) return;
    void invoke("update_taskbar_badge", { count: pendingCount }).catch(() => {});
  }, [pendingCount]);
}
