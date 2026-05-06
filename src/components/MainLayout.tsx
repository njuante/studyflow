import type { ReactNode } from "react";

import type { ViewMode } from "../App";
import type { Tag } from "../types";
import { Toolbar } from "./toolbar/Toolbar";
import styles from "./MainLayout.module.css";

interface MainLayoutProps {
  children: ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onCreateEvent: () => void;
  showToolbar?: boolean;
  tagFilter?: Tag | null;
  onClearTagFilter?: () => void;
}

export function MainLayout({
  children,
  currentDate,
  onCreateEvent,
  onNext,
  onPrev,
  onToday,
  onViewModeChange,
  onClearTagFilter,
  showToolbar = true,
  tagFilter,
  viewMode,
}: MainLayoutProps) {
  return (
    <section className={styles.layout}>
      {showToolbar ? (
        <Toolbar
          currentDate={currentDate}
          onCreateEvent={onCreateEvent}
          onNext={onNext}
          onPrev={onPrev}
          onToday={onToday}
          onViewModeChange={onViewModeChange}
          onClearTagFilter={onClearTagFilter}
          tagFilter={tagFilter}
          viewMode={viewMode}
        />
      ) : null}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
