import { isTauri } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { useEffect, useRef } from "react";

import { toIsoDate } from "../lib/dates";
import type { StudyEvent } from "../types";

const CHECK_INTERVAL_MS = 60_000;
const NOTIFY_LOWER_MIN = 4;
const NOTIFY_UPPER_MIN = 6;

export function useEventStartNotifier(events: StudyEvent[]) {
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isTauri()) return;
    void (async () => {
      try {
        const granted = await isPermissionGranted();
        if (!granted) await requestPermission();
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    function check() {
      const now = new Date();
      const todayIso = toIsoDate(now);

      for (const event of events) {
        if (event.date !== todayIso) continue;
        if (event.completed || !event.scheduled) continue;
        if (notifiedIdsRef.current.has(event.id)) continue;

        const [hours, minutes] = event.startTime.split(":").map(Number);
        const eventStart = new Date(now);
        eventStart.setHours(hours, minutes, 0, 0);

        const minutesUntilStart = (eventStart.getTime() - now.getTime()) / 60_000;
        if (
          minutesUntilStart < NOTIFY_LOWER_MIN ||
          minutesUntilStart > NOTIFY_UPPER_MIN
        ) {
          continue;
        }

        try {
          sendNotification({
            title: "Empieza en 5 minutos",
            body: `${event.title} · ${event.durationMinutes} min`,
            sound: "default",
          });
        } catch {
          /* ignore */
        }

        try {
          const audio = new Audio("/sounds/start-bell.mp3");
          audio.volume = 0.4;
          audio.play().catch(() => {});
        } catch {
          /* ignore */
        }

        notifiedIdsRef.current.add(event.id);
      }
    }

    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [events]);
}
