import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import type { CSSProperties } from "react";

import type { ViewMode } from "../../App";
import { formatMonthYear, formatWeekRange } from "../../lib/dates";
import type { Tag } from "../../types";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateEvent: () => void;
  tagFilter?: Tag | null;
  onClearTagFilter?: () => void;
}

export function Toolbar({
  currentDate,
  onCreateEvent,
  onNext,
  onPrev,
  onToday,
  onViewModeChange,
  onClearTagFilter,
  tagFilter,
  viewMode,
}: ToolbarProps) {
  return (
    <header className={styles.toolbar}>
      <div className={styles.heading}>
        <span className={styles.caption}>
          {viewMode === "month"
            ? formatMonthYear(currentDate)
            : formatWeekRange(currentDate)}
        </span>
        <h1 className={styles.title}>
          {viewMode === "month" ? "Vista mensual" : "Vista semanal"}
        </h1>
      </div>

      <div className={styles.actions}>
        {tagFilter ? (
          <button
            className={styles.filterChip}
            onClick={onClearTagFilter}
            style={{ "--tag-color": tagFilter.color } as CSSProperties}
            type="button"
          >
            <span className={styles.filterDot} />
            <span>{tagFilter.name}</span>
            <X size={12} strokeWidth={1.75} />
          </button>
        ) : null}

        <div className={styles.segmented}>
          <button
            className={`${styles.segmentButton} ${
              viewMode === "month" ? styles.segmentActive : ""
            }`}
            onClick={() => onViewModeChange("month")}
            type="button"
          >
            Mensual
          </button>
          <button
            className={`${styles.segmentButton} ${
              viewMode === "week" ? styles.segmentActive : ""
            }`}
            onClick={() => onViewModeChange("week")}
            type="button"
          >
            Semanal
          </button>
        </div>

        <span className={styles.separator} aria-hidden="true" />

        <div className={styles.navigation}>
          <button className={styles.iconButton} onClick={onPrev} type="button">
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button className={styles.todayButton} onClick={onToday} type="button">
            Hoy
          </button>
          <button className={styles.iconButton} onClick={onNext} type="button">
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>

        <span className={styles.separator} aria-hidden="true" />

        <button
          aria-label="Crear bloque"
          className={styles.createButton}
          onClick={onCreateEvent}
          type="button"
        >
          <Plus size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
