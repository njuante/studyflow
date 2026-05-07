import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { parseQuickCommand, type QuickCommandResult } from "../lib/quickCommand";
import type { StudyEvent } from "../types";

import styles from "./QuickCaptureWindow.module.css";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string };

const THEME_KEY = "studyflow-theme";

function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(THEME_KEY);
  const theme = stored === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
}

function formatPreview(parsed: QuickCommandResult): string {
  return `${parsed.date} · ${parsed.startTime} · ${parsed.durationMinutes}m`;
}

function hideWindow() {
  if (!isTauri()) return;
  void invoke("hide_quick_capture").catch(() => {
    void getCurrentWindow().hide().catch(() => {});
  });
}

export function QuickCaptureWindow() {
  const [value, setValue] = useState("");
  const [parsed, setParsed] = useState<QuickCommandResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    applyStoredTheme();
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) {
        applyStoredTheme();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const tauriWindow = getCurrentWindow();
    let unlisten: (() => void) | null = null;
    void tauriWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused && status.kind !== "success") {
        hideWindow();
      }
    }).then((handler) => {
      unlisten = handler;
    });
    return () => {
      unlisten?.();
    };
  }, [status.kind]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = value.trim();
      setParsed(trimmed ? parseQuickCommand(trimmed) : null);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [value]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        hideWindow();
        return;
      }
      if (event.key === "Enter") {
        if (status.kind !== "idle") return;
        if (!parsed) return;
        event.preventDefault();
        void handleSubmit(parsed);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parsed, status.kind]);

  async function handleSubmit(command: QuickCommandResult) {
    setStatus({ kind: "submitting" });
    const now = new Date().toISOString();
    const event: StudyEvent = {
      id: crypto.randomUUID(),
      title: command.title,
      description: undefined,
      date: command.date,
      startTime: command.startTime,
      durationMinutes: command.durationMinutes,
      tagId: null,
      type: "theory",
      priority: "medium",
      createdAt: now,
      updatedAt: now,
      scheduled: true,
      completed: false,
      completedAt: null,
      lockDuringFocus: false,
    };

    try {
      const created = await invoke<StudyEvent>("create_event", { event });
      await emit("event-created", created).catch(() => {});
      setStatus({
        kind: "success",
        message: `✓ Añadido a ${command.date} ${command.startTime}`,
      });
      setValue("");
      setParsed(null);
      window.setTimeout(() => {
        setStatus({ kind: "idle" });
        hideWindow();
      }, 800);
    } catch {
      setStatus({ kind: "idle" });
    }
  }

  return (
    <div className={styles.shell}>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className={styles.container}
        initial={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
      >
        <Sparkles className={styles.icon} size={20} strokeWidth={1.75} />
        <input
          aria-label="Crear bloque rápido"
          className={styles.input}
          disabled={status.kind === "submitting"}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Repaso DevOps mañana 10:00 1h"
          ref={inputRef}
          value={value}
        />
        {status.kind === "success" ? (
          <span className={styles.success}>{status.message}</span>
        ) : value.trim().length === 0 ? null : parsed ? (
          <span className={styles.preview}>{formatPreview(parsed)}</span>
        ) : (
          <span className={`${styles.preview} ${styles.previewMuted}`}>?</span>
        )}
      </motion.div>
    </div>
  );
}
