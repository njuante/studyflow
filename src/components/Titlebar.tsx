import { invoke, isTauri } from "@tauri-apps/api/core";
import { Moon, Sun } from "lucide-react";

import { AppIcon } from "./AppIcon";
import styles from "./Titlebar.module.css";

interface TitlebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

type WindowCommand =
  | "close_window"
  | "minimize_window"
  | "toggle_maximize_window";

function runWindowCommand(command: WindowCommand) {
  if (!isTauri()) {
    return;
  }

  void invoke(command).catch((error) => {
    window.console.error(`Window command failed: ${command}`, error);
  });
}

export function Titlebar({ theme, onToggleTheme }: TitlebarProps) {
  const ThemeIcon = theme === "light" ? Moon : Sun;

  return (
    <div className={styles.titlebar} data-tauri-drag-region>
      <div className={styles.leading}>
        <div className={styles.trafficLights} aria-label="Controles de ventana">
          <button
            aria-label="Cerrar ventana"
            className={`${styles.light} ${styles.red}`}
            onClick={() => runWindowCommand("close_window")}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
          <button
            aria-label="Minimizar ventana"
            className={`${styles.light} ${styles.amber}`}
            onClick={() => runWindowCommand("minimize_window")}
            type="button"
          >
            <span aria-hidden="true">−</span>
          </button>
          <button
            aria-label="Maximizar o restaurar ventana"
            className={`${styles.light} ${styles.green}`}
            onClick={() => runWindowCommand("toggle_maximize_window")}
            type="button"
          >
            <span aria-hidden="true">⤢</span>
          </button>
        </div>
      </div>

      <div className={styles.windowTitle} data-tauri-drag-region>
        <AppIcon size={14} />
        <span>StudyFlow</span>
      </div>

      <div className={styles.trailing}>
        <button
          aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}
          className={styles.themeButton}
          onClick={onToggleTheme}
          type="button"
        >
          <ThemeIcon size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
