import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ArrowUpCircle, X } from "lucide-react";

import { formatError } from "../lib/formatError";
import styles from "./UpdateBanner.module.css";

interface UpdateState {
  available: boolean;
  version?: string;
  notes?: string;
  downloading: boolean;
  progress: number;
  error?: string;
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({
    available: false,
    downloading: false,
    progress: 0,
  });

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    async function checkForUpdate() {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!cancelled && update?.available) {
          setState((current) => ({
            ...current,
            available: true,
            version: update.version,
            notes: update.body ?? undefined,
            error: undefined,
          }));
        }
      } catch (error) {
        window.console.error("Update check failed:", error);
      }
    }

    void checkForUpdate();
    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  async function applyUpdate() {
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update?.available) return;

      setState((current) => ({
        ...current,
        downloading: true,
        progress: 0,
        error: undefined,
      }));

      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setState((current) => ({
              ...current,
              progress:
                total > 0 ? Math.round((downloaded / total) * 100) : 0,
            }));
            break;
          case "Finished":
            setState((current) => ({ ...current, progress: 100 }));
            break;
        }
      });

      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      console.error("[UpdateBanner] Update install failed:", error);
      setState((current) => ({
        ...current,
        downloading: false,
        error: formatError(error),
      }));
    }
  }

  function dismiss() {
    setState((current) => ({ ...current, available: false }));
  }

  if (!state.available) return null;

  return (
    <div className={styles.banner} role="status">
      <div className={styles.iconWrap} aria-hidden="true">
        <ArrowUpCircle size={16} strokeWidth={1.75} />
      </div>

      <div className={styles.text}>
        <strong>Versión {state.version} disponible</strong>
        {state.notes ? (
          <span className={styles.notes}>{state.notes}</span>
        ) : null}
        {state.error ? (
          <span className={styles.error}>{state.error}</span>
        ) : null}
      </div>

      {state.downloading ? (
        <div className={styles.progress} aria-label="Progreso de descarga">
          <div
            className={styles.progressBar}
            style={{ width: `${state.progress}%` }}
          />
          <span className={styles.progressLabel}>{state.progress}%</span>
        </div>
      ) : (
        <>
          <button className={styles.dismiss} onClick={dismiss} type="button">
            Más tarde
          </button>
          <button className={styles.update} onClick={applyUpdate} type="button">
            Actualizar y reiniciar
          </button>
          <button
            aria-label="Cerrar aviso"
            className={styles.closeIcon}
            onClick={dismiss}
            type="button"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  );
}
