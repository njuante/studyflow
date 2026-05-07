import { useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  register,
  unregister,
} from "@tauri-apps/plugin-global-shortcut";

import { AmbientMesh } from "./components/ambient/AmbientMesh";
import { ArchiveView } from "./components/archive/ArchiveView";
import { EventModal } from "./components/calendar/EventModal";
import { MonthView } from "./components/calendar/MonthView";
import { WeekView } from "./components/calendar/WeekView";
import { CommandPalette } from "./components/commandPalette/CommandPalette";
import { ImportModal } from "./components/import/ImportModal";
import { InboxView } from "./components/inbox/InboxView";
import { MainLayout } from "./components/MainLayout";
import { Sidebar, type SidebarView } from "./components/sidebar/Sidebar";
import { TagDetailView } from "./components/tags/TagDetailView";
import { TagsOverview } from "./components/tags/TagsOverview";
import { Titlebar } from "./components/Titlebar";
import { Toast } from "./components/Toast";
import { TodayView } from "./components/today/TodayView";
import { UpdateBanner } from "./components/UpdateBanner";
import { useEventStartNotifier } from "./hooks/useEventStartNotifier";
import { useTags } from "./hooks/useTags";
import { useTaskbarBadge } from "./hooks/useTaskbarBadge";
import { useTheme } from "./hooks/useTheme";
import { useToast } from "./hooks/useToast";
import {
  countInboxEvents,
  createEvent,
  getEventsInRange,
  scheduleEvent,
  updateEvent,
} from "./lib/api";
import { getMonthGrid, getWeekDays, toIsoDate } from "./lib/dates";
import { DRAG_CONFIG } from "./lib/dragConfig";
import type { StudyFlowDragData, StudyFlowDropData } from "./lib/dragTypes";
import type { QuickCommandResult } from "./lib/quickCommand";
import type { StudyEvent, Tag } from "./types";
import styles from "./App.module.css";

export type ViewMode = "month" | "week";

type EventModalState =
  | {
      mode: "create";
      initialDate?: Date | null;
      initialTime?: string | null;
      initialTagId?: string | null;
    }
  | {
      mode: "edit";
      event: StudyEvent;
    }
  | null;

const IMPORT_SHORTCUT = "CommandOrControl+Shift+V";
const QUICK_CAPTURE_SHORTCUT = "CommandOrControl+Shift+N";
const FOCUS_SHORTCUT = "CommandOrControl+Shift+F";

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

function isDragData(value: unknown): value is StudyFlowDragData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<StudyFlowDragData>;
  return (
    (data.type === "move-event" || data.type === "schedule-from-inbox") &&
    Boolean(data.event)
  );
}

function isDropData(value: unknown): value is StudyFlowDropData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<StudyFlowDropData>;
  return (
    (data.type === "day-slot" && typeof data.getTimeFromY === "function") ||
    data.type === "month-day"
  );
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${remainingMinutes}`.padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snapMinutes(minutes: number, snap: boolean): number {
  if (!snap) {
    return Math.round(minutes);
  }

  return Math.round(minutes / DRAG_CONFIG.snapMinutes) * DRAG_CONFIG.snapMinutes;
}

function App() {
  const { createTag, getTagById } = useTags();
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
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagDetailBackView, setTagDetailBackView] =
    useState<"tags" | "calendar">("tags");
  const [inboxCount, setInboxCount] = useState(0);
  const [activeDrag, setActiveDrag] = useState<StudyFlowDragData | null>(null);
  const [optimisticallyRemovedInboxId, setOptimisticallyRemovedInboxId] =
    useState<string | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const pointerStateRef = useRef({
    altKey: false,
    shiftKey: false,
    x: 0,
    y: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_CONFIG.activationDistance },
    }),
  );

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
    if (activeView !== "calendar" && activeView !== "inbox") {
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

    void register(QUICK_CAPTURE_SHORTCUT, (event) => {
      if (event.state === "Pressed") {
        void invoke("toggle_quick_capture").catch(() => {});
      }
    }).catch(() => {
      if (isMounted) {
        showToast(
          "No se pudo registrar Ctrl+Shift+N. Puede que otra app ya lo use.",
          "error",
        );
      }
    });

    void register(FOCUS_SHORTCUT, (event) => {
      if (event.state === "Pressed") {
        void launchFocusForCurrentEvent();
      }
    }).catch(() => {
      if (isMounted) {
        showToast(
          "No se pudo registrar Ctrl+Shift+F. Puede que otra app ya lo use.",
          "error",
        );
      }
    });

    return () => {
      isMounted = false;
      void unregister(IMPORT_SHORTCUT).catch(() => {});
      void unregister(QUICK_CAPTURE_SHORTCUT).catch(() => {});
      void unregister(FOCUS_SHORTCUT).catch(() => {});
    };
  }, [showToast]);

  async function launchFocusForCurrentEvent() {
    try {
      const current = await invoke<StudyEvent | null>("get_current_event");
      if (!current) {
        showToast("No hay ningún bloque en curso", "info");
        return;
      }
      await invoke("open_focus_window", { eventId: current.id });
    } catch {
      showToast("No se pudo abrir el modo Focus", "error");
    }
  }

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let unlisten: (() => void) | null = null;
    void listen("event-created", () => {
      setRefreshKey((current) => current + 1);
      showToast("Bloque añadido desde Quick Capture", "success");
    }).then((handler) => {
      unlisten = handler;
    });
    return () => {
      unlisten?.();
    };
  }, [showToast]);

  useEffect(() => {
    function rememberPointer(event: PointerEvent) {
      pointerStateRef.current = {
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        x: event.clientX,
        y: event.clientY,
      };
    }

    function rememberKeys(event: KeyboardEvent) {
      pointerStateRef.current = {
        ...pointerStateRef.current,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      };
    }

    window.addEventListener("pointermove", rememberPointer);
    window.addEventListener("pointerup", rememberPointer);
    window.addEventListener("keydown", rememberKeys);
    window.addEventListener("keyup", rememberKeys);

    return () => {
      window.removeEventListener("pointermove", rememberPointer);
      window.removeEventListener("pointerup", rememberPointer);
      window.removeEventListener("keydown", rememberKeys);
      window.removeEventListener("keyup", rememberKeys);
    };
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "k" && !event.shiftKey) {
        event.preventDefault();
        setShowCommandPalette((current) => !current);
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (key === "1" && !event.shiftKey) {
        event.preventDefault();
        setActiveView("calendar");
        setViewMode("month");
        return;
      }

      if (key === "2" && !event.shiftKey) {
        event.preventDefault();
        setActiveView("calendar");
        setViewMode("week");
        return;
      }

      if (key === "t" && !event.shiftKey) {
        event.preventDefault();
        setCurrentDate(new Date());
        return;
      }

      if (key === "d" && !event.shiftKey) {
        event.preventDefault();
        toggleTheme();
        return;
      }

      if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        setEventModalState({
          mode: "create",
          initialDate: new Date(),
          initialTime: "09:00",
        });
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

  function handleCreateWithTag(tagId: string) {
    setEventModalState({
      mode: "create",
      initialDate: new Date(),
      initialTime: "09:00",
      initialTagId: tagId,
    });
  }

  function handleSelectTag(tagId: string, sourceView: SidebarView = activeView) {
    setSelectedTagId(tagId);
    setTagDetailBackView(sourceView === "calendar" ? "calendar" : "tags");
    setActiveView("tag-detail");
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

  function handleCommandCreateTag() {
    const name = window.prompt("Nombre de la etiqueta");
    if (!name?.trim()) return;
    createTag(name.trim(), "#378ADD")
      .then(() => showToast("Etiqueta creada", "success"))
      .catch(() => showToast("No se pudo crear la etiqueta", "error"));
  }

  async function handleQuickCreate(parsed: QuickCommandResult) {
    const now = new Date().toISOString();
    const event: StudyEvent = {
      id: crypto.randomUUID(),
      title: parsed.title,
      description: undefined,
      date: parsed.date,
      startTime: parsed.startTime,
      durationMinutes: parsed.durationMinutes,
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
      await createEvent(event);
      setRefreshKey((current) => current + 1);
      showToast(`"${parsed.title}" añadido`, "success");
    } catch {
      showToast("No se pudo crear el bloque", "error");
    }
  }

  function handleSelectTagFromPalette(tag: Tag) {
    handleSelectTag(tag.id);
  }

  function isDateInVisibleCalendar(date: string): boolean {
    const visibleDates =
      viewMode === "month" ? getMonthGrid(currentDate) : getWeekDays(currentDate);
    return visibleDates.some((visibleDate) => toIsoDate(visibleDate) === date);
  }

  function upsertVisibleEvent(
    currentEvents: StudyEvent[],
    nextEvent: StudyEvent,
  ): StudyEvent[] {
    const withoutEvent = currentEvents.filter((event) => event.id !== nextEvent.id);
    if (!isDateInVisibleCalendar(nextEvent.date)) {
      return withoutEvent;
    }

    return [...withoutEvent, nextEvent];
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setActiveDrag(isDragData(data) ? data : null);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDrag(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragData = event.active.data.current;
    const dropData = event.over?.data.current;

    setActiveDrag(null);

    if (!isDragData(dragData) || !isDropData(dropData)) {
      return;
    }

    const { altKey, shiftKey, y } = pointerStateRef.current;

    if (dragData.type === "move-event") {
      const originalEvent = dragData.event;
      const newDate = dropData.date;
      const duplicate = altKey;
      const now = new Date().toISOString();
      let newStartTime = originalEvent.startTime;

      if (dropData.type === "day-slot") {
        const deltaMinutes = snapMinutes(
          event.delta.y / DRAG_CONFIG.pixelsPerMinute,
          !shiftKey,
        );
        const nextStartMinutes = clamp(
          timeToMinutes(originalEvent.startTime) + deltaMinutes,
          0,
          23 * 60 + 45,
        );
        newStartTime = minutesToTime(nextStartMinutes);
      }

      const nextEvent: StudyEvent = {
        ...originalEvent,
        date: newDate,
        id: duplicate ? crypto.randomUUID() : originalEvent.id,
        startTime: newStartTime,
        createdAt: duplicate ? now : originalEvent.createdAt,
        updatedAt: now,
        scheduled: true,
      };

      if (
        !duplicate &&
        originalEvent.date === nextEvent.date &&
        originalEvent.startTime === nextEvent.startTime
      ) {
        return;
      }

      void persistMovedEvent(originalEvent, nextEvent, duplicate);
      return;
    }

    if (dragData.type === "schedule-from-inbox") {
      const startTime =
        dropData.type === "day-slot" ? dropData.getTimeFromY(y) : "09:00";
      void persistScheduledInboxEvent(dragData.event, dropData.date, startTime);
    }
  }

  async function persistMovedEvent(
    originalEvent: StudyEvent,
    nextEvent: StudyEvent,
    duplicate: boolean,
  ) {
    const previousEvents = events;

    setEvents((current) =>
      duplicate
        ? upsertVisibleEvent(current, nextEvent)
        : current.map((event) =>
            event.id === originalEvent.id ? nextEvent : event,
          ),
    );

    try {
      const saved = duplicate
        ? await createEvent(nextEvent)
        : await updateEvent(nextEvent);
      setEvents((current) => upsertVisibleEvent(current, saved));
      showToast(duplicate ? "Bloque duplicado" : "Bloque movido", "success");
    } catch {
      setEvents(previousEvents);
      showToast(
        duplicate ? "No se pudo duplicar el bloque" : "No se pudo mover el bloque",
        "error",
      );
    }
  }

  async function persistScheduledInboxEvent(
    event: StudyEvent,
    date: string,
    startTime: string,
  ) {
    const previousEvents = events;
    const previousInboxCount = inboxCount;
    const now = new Date().toISOString();
    const optimisticEvent: StudyEvent = {
      ...event,
      date,
      scheduled: true,
      startTime,
      updatedAt: now,
    };

    setOptimisticallyRemovedInboxId(event.id);
    setInboxCount((current) => Math.max(0, current - 1));
    setEvents((current) => upsertVisibleEvent(current, optimisticEvent));

    try {
      const saved = await scheduleEvent(event.id, date, startTime);
      setEvents((current) => upsertVisibleEvent(current, saved));
      showToast("Bloque programado en el calendario", "success");
    } catch {
      setEvents(previousEvents);
      setInboxCount(previousInboxCount);
      setOptimisticallyRemovedInboxId(null);
      setRefreshKey((current) => current + 1);
      showToast("No se pudo programar el bloque", "error");
    }
  }

  async function handleEventResize(event: StudyEvent, durationMinutes: number) {
    const previousEvents = events;
    const nextEvent: StudyEvent = {
      ...event,
      durationMinutes,
      updatedAt: new Date().toISOString(),
    };

    setEvents((current) =>
      current.map((currentEvent) =>
        currentEvent.id === event.id ? nextEvent : currentEvent,
      ),
    );

    try {
      const saved = await updateEvent(nextEvent);
      setEvents((current) =>
        current.map((currentEvent) =>
          currentEvent.id === saved.id ? saved : currentEvent,
        ),
      );
    } catch {
      setEvents(previousEvents);
      showToast("No se pudo redimensionar el bloque", "error");
    }
  }

  const showCalendarToolbar = activeView === "calendar" || activeView === "inbox";
  const editingEvent = eventModalState?.mode === "edit" ? eventModalState.event : null;
  const creationDate = eventModalState?.mode === "create" ? eventModalState.initialDate : null;
  const creationTime = eventModalState?.mode === "create" ? eventModalState.initialTime : null;
  const creationTagId = eventModalState?.mode === "create" ? eventModalState.initialTagId : null;
  const tagFilter = getTagById(tagFilterId);
  const activeDragTag = activeDrag ? getTagById(activeDrag.event.tagId) : null;
  const activeDragEventId =
    activeDrag?.type === "move-event" ? activeDrag.event.id : null;
  const dragModifiers = useMemo(
    () => (activeDrag?.type === "schedule-from-inbox" ? [snapCenterToCursor] : []),
    [activeDrag?.type],
  );
  const visibleEvents = useMemo(
    () =>
      tagFilterId
        ? events.filter((event) => event.tagId === tagFilterId)
        : events,
    [events, tagFilterId],
  );

  const todayPending = useMemo(() => {
    const todayIso = toIsoDate(new Date());
    return events.filter(
      (event) =>
        event.scheduled &&
        !event.completed &&
        event.date === todayIso,
    ).length;
  }, [events]);

  useTaskbarBadge(todayPending);
  useEventStartNotifier(events);

  useEffect(() => {
    if (tagFilterId && !tagFilter) {
      setTagFilterId(null);
    }
  }, [tagFilter, tagFilterId]);

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={dragModifiers}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className={styles.appShell} data-theme={theme}>
      <AmbientMesh dark={theme === "dark"} />
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
          onSelectTag={(tagId) => handleSelectTag(tagId)}
          onViewChange={setActiveView}
          selectedTagId={selectedTagId}
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
              onChanged={() => setRefreshKey((current) => current + 1)}
              onEditEvent={handleEventClick}
              onCompletedChange={() =>
                setRefreshKey((current) => current + 1)
              }
              refreshKey={refreshKey}
            />
          ) : activeView === "tags" ? (
            <TagsOverview
              onCreateEventWithTag={handleCreateWithTag}
              onEventClick={handleEventClick}
              onFilterTag={(tagId) => {
                setActiveView("calendar");
                setTagFilterId(tagId);
              }}
              onOpenTag={(tagId) => handleSelectTag(tagId, "tags")}
              onShowToast={showToast}
              refreshKey={refreshKey}
            />
          ) : activeView === "tag-detail" ? (
            <TagDetailView
              onBack={() => setActiveView(tagDetailBackView)}
              onCreateEventWithTag={handleCreateWithTag}
              onEventClick={handleEventClick}
              onShowToast={showToast}
              refreshKey={refreshKey}
              selectedTagId={selectedTagId}
            />
          ) : activeView === "inbox" ? (
            <div className={styles.inboxCalendarSplit}>
              <div className={styles.inboxPane}>
                <InboxView
                  onChanged={() => setRefreshKey((current) => current + 1)}
                  onEditEvent={(event) =>
                    setEventModalState({ mode: "edit", event })
                  }
                  onShowToast={showToast}
                  optimisticallyRemovedEventId={optimisticallyRemovedInboxId}
                  refreshKey={refreshKey}
                />
              </div>
              <div className={styles.inboxCalendarPane}>
                {viewMode === "month" ? (
                  <MonthView
                    activeDragEventId={activeDragEventId}
                    currentDate={currentDate}
                    events={visibleEvents}
                    onCreateOnDay={handleCreateOnDay}
                    onDayClick={handleDayClick}
                    onEventClick={handleEventClick}
                  />
                ) : (
                  <WeekView
                    activeDragEventId={activeDragEventId}
                    currentDate={currentDate}
                    events={visibleEvents}
                    onCreateAt={handleCreateAt}
                    onEventClick={handleEventClick}
                    onEventResize={handleEventResize}
                  />
                )}
              </div>
            </div>
          ) : activeView === "archive" ? (
            <ArchiveView
              onEventClick={handleEventClick}
              refreshKey={refreshKey}
            />
          ) : activeView === "calendar" && viewMode === "month" ? (
            <MonthView
              activeDragEventId={activeDragEventId}
              currentDate={currentDate}
              events={visibleEvents}
              onCreateOnDay={handleCreateOnDay}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          ) : activeView === "calendar" && viewMode === "week" ? (
            <WeekView
              activeDragEventId={activeDragEventId}
              currentDate={currentDate}
              events={visibleEvents}
              onCreateAt={handleCreateAt}
              onEventClick={handleEventClick}
              onEventResize={handleEventResize}
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
        initialTagId={creationTagId}
        initialTime={creationTime}
        onClose={() => setEventModalState(null)}
        onDeleted={handleEventDeleted}
        onSaved={handleEventSaved}
        open={eventModalState !== null}
      />

      <CommandPalette
        onClose={() => setShowCommandPalette(false)}
        onCreateEvent={handleCreateEvent}
        onCreateTag={handleCommandCreateTag}
        onFocusMode={() => void launchFocusForCurrentEvent()}
        onGoCalendar={() => setActiveView("calendar")}
        onGoInbox={() => setActiveView("inbox")}
        onGoToday={() => {
          setActiveView("today");
          setCurrentDate(new Date());
        }}
        onImport={() => setShowImport(true)}
        onQuickCreate={handleQuickCreate}
        onSelectEvent={handleEventClick}
        onSelectTag={handleSelectTagFromPalette}
        onSetViewMode={(mode) => {
          setActiveView("calendar");
          setViewMode(mode);
        }}
        onToggleTheme={toggleTheme}
        open={showCommandPalette}
        theme={theme}
      />
      </div>

      <DragOverlay>
        {activeDrag ? (
          <div
            className={styles.dragGhost}
            style={{
              background: activeDragTag?.color ?? "#8E8E93",
            }}
          >
            {activeDrag.event.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
