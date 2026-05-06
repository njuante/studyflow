import { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";

import { ArchiveView } from "./components/archive/ArchiveView";
import { EventModal } from "./components/calendar/EventModal";
import { MonthView } from "./components/calendar/MonthView";
import { WeekView } from "./components/calendar/WeekView";
import { ImportModal } from "./components/import/ImportModal";
import { InboxView } from "./components/inbox/InboxView";
import { MainLayout } from "./components/MainLayout";
import { Sidebar, type SidebarView } from "./components/sidebar/Sidebar";
import { Titlebar } from "./components/Titlebar";
import { Toast } from "./components/Toast";
import { TodayView } from "./components/today/TodayView";
import { UpdateBanner } from "./components/UpdateBanner";
import { useTags } from "./hooks/useTags";
import { useTheme } from "./hooks/useTheme";
import { useToast } from "./hooks/useToast";
import { countInboxEvents, getEventsInRange } from "./lib/api";
import { getMonthGrid, getWeekDays, toIsoDate } from "./lib/dates";
import type { StudyEvent } from "./types";
import styles from "./App.module.css";

export type ViewMode = "month" | "week";

type EventModalState =
  | {
      mode: "create";
      initialDate?: Date | null;
      initialTime?: string | null;
    }
  | {
      mode: "edit";
      event: StudyEvent;
    }
  | null;

const IMPORT_SHORTCUT = "CommandOrControl+Shift+V";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function App() {
  const { getTagById } = useTags();
  const { theme, toggleTheme } = useTheme();
  const { toast, showToast } = useToast();
  const [activeView, setActiveView] = useState<SidebarView>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [eventModalState, setEventModalState] = useState<EventModalState>(null);
  const [tagFilterId, setTagFilterId] = useState<string | null>(null);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    countInboxEvents()
      .then((count) => {
        if (!cancelled) setInboxCount(count);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (activeView !== "calendar") {
      return;
    }

    const visibleDates =
      viewMode === "month" ? getMonthGrid(currentDate) : getWeekDays(currentDate);
    const startDate = toIsoDate(visibleDates[0]);
    const endDate = toIsoDate(visibleDates[visibleDates.length - 1]);
    let cancelled = false;

    getEventsInRange(startDate, endDate)
      .then((visibleEvents) => {
        if (!cancelled) {
          setEvents(visibleEvents);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, currentDate, refreshKey, viewMode]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let isMounted = true;

    void register(IMPORT_SHORTCUT, (event) => {
      if (event.state === "Pressed") {
        setShowImport(true);
      }
    }).catch(() => {
      if (isMounted) {
        showToast(
          "No se pudo registrar Ctrl+Shift+V. Puede que otra app ya lo use.",
          "error",
        );
      }
    });

    return () => {
      isMounted = false;
      void unregister(IMPORT_SHORTCUT).catch(() => {});
    };
  }, [showToast]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || isTypingTarget(event.target)) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "1") {
        event.preventDefault();
        setActiveView("today");
        return;
      }

      if (key === "2") {
        event.preventDefault();
        setActiveView("calendar");
        return;
      }

      if (key === "t" && !event.shiftKey) {
        event.preventDefault();
        toggleTheme();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [toggleTheme]);

  function handlePrevious() {
    setCurrentDate((current) => {
      const nextDate = new Date(current);
      if (viewMode === "month") {
        nextDate.setMonth(current.getMonth() - 1);
      } else {
        nextDate.setDate(current.getDate() - 7);
      }
      return nextDate;
    });
  }

  function handleNext() {
    setCurrentDate((current) => {
      const nextDate = new Date(current);
      if (viewMode === "month") {
        nextDate.setMonth(current.getMonth() + 1);
      } else {
        nextDate.setDate(current.getDate() + 7);
      }
      return nextDate;
    });
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handleCreateEvent() {
    setEventModalState({
      mode: "create",
      initialDate: new Date(),
      initialTime: "09:00",
    });
  }

  function handleEventClick(event: StudyEvent) {
    setEventModalState({
      mode: "edit",
      event,
    });
  }

  function handleDayClick(date: Date) {
    window.console.info("Day clicked", toIsoDate(date));
  }

  function handleCreateOnDay(date: Date) {
    setEventModalState({
      mode: "create",
      initialDate: date,
      initialTime: "09:00",
    });
  }

  function handleCreateAt(date: Date, time: string) {
    setEventModalState({
      mode: "create",
      initialDate: date,
      initialTime: time,
    });
  }

  function handleImportComplete(count: number) {
    setRefreshKey((current) => current + 1);
    showToast(`${count} bloques añadidos al calendario`, "success");
  }

  function handleEventSaved(_event: StudyEvent, mode: "create" | "update") {
    setRefreshKey((current) => current + 1);
    showToast(
      mode === "create"
        ? "Bloque añadido al calendario"
        : "Cambios guardados",
      "success",
    );
  }

  function handleEventDeleted() {
    setRefreshKey((current) => current + 1);
    showToast("Bloque eliminado", "info");
  }

  const showCalendarToolbar = activeView === "calendar";
  const editingEvent = eventModalState?.mode === "edit" ? eventModalState.event : null;
  const creationDate = eventModalState?.mode === "create" ? eventModalState.initialDate : null;
  const creationTime = eventModalState?.mode === "create" ? eventModalState.initialTime : null;
  const tagFilter = getTagById(tagFilterId);
  const visibleEvents = useMemo(
    () =>
      tagFilterId
        ? events.filter((event) => event.tagId === tagFilterId)
        : events,
    [events, tagFilterId],
  );

  useEffect(() => {
    if (tagFilterId && !tagFilter) {
      setTagFilterId(null);
    }
  }, [tagFilter, tagFilterId]);

  return (
    <div className={styles.appShell} data-theme={theme}>
      <div className={styles.titlebar}>
        <Titlebar theme={theme} onToggleTheme={toggleTheme} />
      </div>

      <div className={styles.updateBanner}>
        <UpdateBanner />
      </div>

      <aside className={styles.sidebar}>
        <Sidebar
          activeView={activeView}
          inboxCount={inboxCount}
          onFilterTag={(tagId) => {
            setActiveView("calendar");
            setTagFilterId(tagId);
          }}
          onImportClick={() => setShowImport(true)}
          onViewChange={setActiveView}
        />
      </aside>

      <main className={styles.main}>
        <MainLayout
          currentDate={currentDate}
          onCreateEvent={handleCreateEvent}
          onNext={handleNext}
          onPrev={handlePrevious}
          onToday={handleToday}
          onViewModeChange={setViewMode}
          showToolbar={showCalendarToolbar}
          tagFilter={tagFilter}
          onClearTagFilter={() => setTagFilterId(null)}
          viewMode={viewMode}
        >
          {activeView === "today" ? (
            <TodayView
              onCompletedChange={() =>
                setRefreshKey((current) => current + 1)
              }
              refreshKey={refreshKey}
            />
          ) : activeView === "inbox" ? (
            <InboxView
              onChanged={() => setRefreshKey((current) => current + 1)}
              onEditEvent={(event) =>
                setEventModalState({ mode: "edit", event })
              }
              onShowToast={showToast}
              refreshKey={refreshKey}
            />
          ) : activeView === "archive" ? (
            <ArchiveView
              onEventClick={handleEventClick}
              refreshKey={refreshKey}
            />
          ) : activeView === "calendar" && viewMode === "month" ? (
            <MonthView
              currentDate={currentDate}
              events={visibleEvents}
              onCreateOnDay={handleCreateOnDay}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          ) : activeView === "calendar" && viewMode === "week" ? (
            <WeekView
              currentDate={currentDate}
              events={visibleEvents}
              onCreateAt={handleCreateAt}
              onEventClick={handleEventClick}
            />
          ) : (
            <div className={styles.placeholder}>Calendario aqui</div>
          )}
        </MainLayout>
      </main>

      <Toast toast={toast} />

      <ImportModal
        onClose={() => setShowImport(false)}
        onImportComplete={handleImportComplete}
        open={showImport}
      />

      <EventModal
        event={editingEvent}
        initialDate={creationDate}
        initialTime={creationTime}
        onClose={() => setEventModalState(null)}
        onDeleted={handleEventDeleted}
        onSaved={handleEventSaved}
        open={eventModalState !== null}
      />
    </div>
  );
}

export default App;
