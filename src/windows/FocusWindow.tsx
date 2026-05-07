import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { motion, useAnimationControls } from "framer-motion";
import { Check, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { StudyEvent, Tag } from "../types";

import styles from "./FocusWindow.module.css";

const THEME_KEY = "studyflow-theme";
const NEUTRAL_COLOR = "#8e8e93";

function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(THEME_KEY);
  document.documentElement.setAttribute(
    "data-theme",
    stored === "dark" ? "dark" : "light",
  );
}

function readEventIdFromHash(): string | null {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf("?");
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return params.get("event");
}

function eventEndTimestamp(event: StudyEvent): number {
  const [hours, minutes] = event.startTime.split(":").map(Number);
  const [year, month, day] = event.date.split("-").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return start.getTime() + event.durationMinutes * 60_000;
}

function pad(value: number): string {
  return `${value}`.padStart(2, "0");
}

function hideFocusWindow() {
  if (!isTauri()) return;
  void invoke("close_focus_window").catch(() => {
    void getCurrentWindow().hide().catch(() => {});
  });
}

export function FocusWindow() {
  const [event, setEvent] = useState<StudyEvent | null>(null);
  const [next, setNext] = useState<StudyEvent | null>(null);
  const [tag, setTag] = useState<Tag | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const completionFiredRef = useRef(false);
  const widgetControls = useAnimationControls();

  useEffect(() => {
    applyStoredTheme();
    const onStorage = (storageEvent: StorageEvent) => {
      if (storageEvent.key === THEME_KEY) applyStoredTheme();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const id = readEventIdFromHash();
    if (id) void loadEvent(id);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    void listen<string>("focus-event-changed", (incoming) => {
      void loadEvent(incoming.payload);
    }).then((handler) => {
      unlisten = handler;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  async function loadEvent(id: string) {
    completionFiredRef.current = false;
    try {
      const ev = await invoke<StudyEvent>("get_event_by_id", { id });
      setEvent(ev);
      const upcoming = await invoke<StudyEvent | null>("get_next_event").catch(
        () => null,
      );
      setNext(upcoming);
      const tags = await invoke<Tag[]>("get_tags").catch(() => [] as Tag[]);
      setTag(tags.find((t) => t.id === ev.tagId) ?? null);
    } catch {
      /* leave previous state */
    }
  }

  useEffect(() => {
    if (!event) return;
    const end = eventEndTimestamp(event);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0 && !completionFiredRef.current) {
        completionFiredRef.current = true;
        void onTimerExpired(event);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [event]);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let unlisten: (() => void) | null = null;
    void win.onCloseRequested((closeEvent) => {
      if (event?.lockDuringFocus && secondsRemaining > 0) {
        closeEvent.preventDefault();
        triggerShake();
      }
    }).then((handler) => {
      unlisten = handler;
    });
    return () => {
      unlisten?.();
    };
  }, [event, secondsRemaining]);

  function triggerShake() {
    void widgetControls.start({
      x: [0, -6, 6, -4, 4, -2, 0],
      transition: { duration: 0.4, ease: "easeInOut" },
    });
  }

  async function onTimerExpired(finished: StudyEvent) {
    try {
      const audio = new Audio("/finish.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {
      /* ignore */
    }

    try {
      let granted = await isPermissionGranted().catch(() => false);
      if (!granted) {
        const result = await requestPermission().catch(() => "denied");
        granted = result === "granted";
      }
      if (granted) {
        sendNotification({
          title: "Bloque completado",
          body: `${finished.title} · ${finished.durationMinutes} min`,
        });
      }
    } catch {
      /* ignore */
    }

    window.setTimeout(() => {
      hideFocusWindow();
    }, 5000);
  }

  async function handleComplete() {
    if (!event || isCompleting) return;
    setIsCompleting(true);
    try {
      await invoke("complete_event", { id: event.id });
      if (next) {
        await loadEvent(next.id);
      } else {
        hideFocusWindow();
      }
    } finally {
      setIsCompleting(false);
    }
  }

  function handleCloseClick() {
    if (event?.lockDuringFocus && secondsRemaining > 0) {
      triggerShake();
      return;
    }
    hideFocusWindow();
  }

  if (!event) {
    return <div className={styles.shell} />;
  }

  const totalSeconds = event.durationMinutes * 60;
  const progress =
    totalSeconds <= 0
      ? 1
      : Math.min(1, Math.max(0, 1 - secondsRemaining / totalSeconds));
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const accentColor = tag?.color ?? NEUTRAL_COLOR;
  const showLockBadge = event.lockDuringFocus && secondsRemaining > 0;

  return (
    <div className={styles.shell}>
      <motion.div
        animate={widgetControls}
        className={styles.widget}
        initial={false}
        style={{ ["--accent-color" as string]: accentColor }}
      >
        <div className={styles.header} data-tauri-drag-region>
          <span
            className={styles.tagDot}
            style={{ background: accentColor }}
          />
          <span className={styles.tagName}>{tag?.name ?? "Sin etiqueta"}</span>
          {showLockBadge ? (
            <span className={styles.lockBadge}>
              <Lock size={10} strokeWidth={2} />
              Bloqueado
            </span>
          ) : (
            <button
              aria-label="Cerrar"
              className={styles.close}
              onClick={handleCloseClick}
              type="button"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <h3 className={styles.title}>{event.title}</h3>

        <div className={styles.timer}>
          {pad(minutes)}:{pad(seconds)}
        </div>

        <div className={styles.progressTrack}>
          <motion.div
            animate={{ width: `${progress * 100}%` }}
            className={styles.progressBar}
            style={{ background: accentColor }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {next ? (
          <div className={styles.nextEvent}>
            <span className={styles.nextLabel}>Siguiente</span>
            <span className={styles.nextTitle}>{next.title}</span>
            <span className={styles.nextTime}>{next.startTime}</span>
          </div>
        ) : null}

        <button
          className={styles.completeBtn}
          disabled={isCompleting}
          onClick={() => void handleComplete()}
          type="button"
        >
          <Check size={13} strokeWidth={2.5} />
          Completado
        </button>
      </motion.div>
    </div>
  );
}
