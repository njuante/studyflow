import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  Clock,
  Focus,
  Hash,
  Inbox,
  LayoutGrid,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Tag as TagIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useTags } from "../../hooks/useTags";
import { getEventsInRange } from "../../lib/api";
import { toIsoDate } from "../../lib/dates";
import { useMotionPresets } from "../../lib/motion";
import { parseQuickCommand, type QuickCommandResult } from "../../lib/quickCommand";
import type { StudyEvent, Tag } from "../../types";

import styles from "./CommandPalette.module.css";

export interface CommandPaletteHandlers {
  onCreateEvent: () => void;
  onImport: () => void;
  onSetViewMode: (mode: "month" | "week") => void;
  onGoToday: () => void;
  onGoInbox: () => void;
  onGoCalendar: () => void;
  onToggleTheme: () => void;
  onCreateTag: () => void;
  onSelectEvent: (event: StudyEvent) => void;
  onSelectTag: (tag: Tag) => void;
  onQuickCreate: (parsed: QuickCommandResult) => void;
  onFocusMode: () => void;
}

interface CommandPaletteProps extends CommandPaletteHandlers {
  open: boolean;
  onClose: () => void;
  theme: "light" | "dark";
}

type TabKey = "all" | "actions" | "events" | "tags";
type ActionId =
  | "create-event"
  | "import"
  | "view-month"
  | "view-week"
  | "go-today"
  | "go-inbox"
  | "go-calendar"
  | "toggle-theme"
  | "create-tag"
  | "focus-mode";

interface Recent {
  kind: "action" | "event" | "tag";
  id: string;
}

const RECENTS_KEY = "studyflow.commandPalette.recents";
const MAX_RECENTS = 5;

function loadRecents(): Recent[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENTS) as Recent[];
  } catch {
    return [];
  }
}

function saveRecent(entry: Recent) {
  try {
    const current = loadRecents().filter(
      (item) => !(item.kind === entry.kind && item.id === entry.id),
    );
    current.unshift(entry);
    window.localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify(current.slice(0, MAX_RECENTS)),
    );
  } catch {
    /* ignore */
  }
}

const TABS: Array<{ id: TabKey; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "actions", label: "Acciones" },
  { id: "events", label: "Eventos" },
  { id: "tags", label: "Etiquetas" },
];

function formatEventDate(event: StudyEvent): string {
  if (!event.scheduled) return "Inbox";
  const [year, month, day] = event.date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    weekday: "short",
  }).format(date) + ` · ${event.startTime}`;
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className={styles.shortcut} aria-hidden="true">
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`}>{key}</kbd>
      ))}
    </span>
  );
}

interface ItemProps {
  value: string;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  sub?: string;
  shortcut?: string[];
  keywords?: string[];
}

function Item({ value, onSelect, icon, title, sub, shortcut, keywords }: ItemProps) {
  return (
    <Command.Item
      className={styles.item}
      onSelect={onSelect}
      value={value}
      keywords={keywords}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <span className={styles.itemBody}>
        <span className={styles.itemTitle}>{title}</span>
        {sub ? <span className={styles.itemSub}>{sub}</span> : null}
      </span>
      {shortcut ? <Shortcut keys={shortcut} /> : null}
    </Command.Item>
  );
}

export function CommandPalette({
  onClose,
  onCreateEvent,
  onCreateTag,
  onFocusMode,
  onGoCalendar,
  onGoInbox,
  onGoToday,
  onImport,
  onQuickCreate,
  onSelectEvent,
  onSelectTag,
  onSetViewMode,
  onToggleTheme,
  open,
  theme,
}: CommandPaletteProps) {
  const { tags } = useTags();
  const { springs, fades } = useMotionPresets();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [events, setEvents] = useState<StudyEvent[]>([]);
  const [recents, setRecents] = useState<Recent[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("all");
      return;
    }
    setRecents(loadRecents());

    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    const end = new Date(today);
    end.setDate(today.getDate() + 30);

    let cancelled = false;
    getEventsInRange(toIsoDate(start), toIsoDate(end))
      .then((loaded) => {
        if (!cancelled) setEvents(loaded);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const isFreeTextMode = query.startsWith(">");
  const freeText = isFreeTextMode ? query.slice(1).trim() : "";
  const parsedCommand = useMemo(
    () => (isFreeTextMode ? parseQuickCommand(freeText) : null),
    [freeText, isFreeTextMode],
  );

  const eventById = useMemo(() => {
    const map = new Map<string, StudyEvent>();
    for (const event of events) map.set(event.id, event);
    return map;
  }, [events]);

  const tagById = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const tag of tags) map.set(tag.id, tag);
    return map;
  }, [tags]);

  function close() {
    onClose();
  }

  function runAction(id: ActionId, fn: () => void) {
    saveRecent({ kind: "action", id });
    fn();
    close();
  }

  function runEvent(event: StudyEvent) {
    saveRecent({ kind: "event", id: event.id });
    onSelectEvent(event);
    close();
  }

  function runTag(tag: Tag) {
    saveRecent({ kind: "tag", id: tag.id });
    onSelectTag(tag);
    close();
  }

  function runQuickCreate() {
    if (!parsedCommand) return;
    onQuickCreate(parsedCommand);
    close();
  }

  const showActions = tab === "all" || tab === "actions";
  const showEvents = tab === "all" || tab === "events";
  const showTags = tab === "all" || tab === "tags";
  const showRecents = !isFreeTextMode && query.trim().length === 0 && tab === "all";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          aria-modal="true"
          className={styles.overlay}
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          onClick={close}
          role="dialog"
          transition={fades.default}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={styles.palette}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            onClick={(event) => event.stopPropagation()}
            transition={springs.appear}
          >
            <Command
              label="Paleta de comandos"
              loop
              shouldFilter={!isFreeTextMode}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
            >
              <div className={styles.inputRow}>
                <Search className={styles.inputIcon} size={18} strokeWidth={1.75} />
                <Command.Input
                  className={styles.input}
                  onValueChange={setQuery}
                  placeholder={
                    isFreeTextMode
                      ? "Comando rápido — describe el bloque"
                      : "Busca o ejecuta una acción..."
                  }
                  ref={inputRef}
                  value={query}
                />
                {isFreeTextMode ? (
                  <span className={styles.modeBadge}>Crear</span>
                ) : null}
              </div>

              {!isFreeTextMode ? (
                <div className={styles.tabs}>
                  {TABS.map((tabOption) => (
                    <button
                      className={`${styles.tab} ${
                        tab === tabOption.id ? styles.tabActive : ""
                      }`}
                      key={tabOption.id}
                      onClick={() => setTab(tabOption.id)}
                      type="button"
                    >
                      {tabOption.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <Command.List className={styles.list}>
                {isFreeTextMode ? (
                  <FreeTextSection
                    parsed={parsedCommand}
                    rawText={freeText}
                    onConfirm={runQuickCreate}
                  />
                ) : (
                  <>
                    <Command.Empty className={styles.empty}>
                      No hay resultados
                    </Command.Empty>

                    {showRecents && recents.length > 0 ? (
                      <Command.Group
                        heading="Reciente"
                        className={styles.heading}
                      >
                        {recents.map((recent) => {
                          if (recent.kind === "action") {
                            const action = ACTION_DEFINITIONS.find(
                              (def) => def.id === recent.id,
                            );
                            if (!action) return null;
                            return (
                              <Item
                                icon={<action.Icon size={16} strokeWidth={1.75} />}
                                key={`recent-action-${recent.id}`}
                                onSelect={() =>
                                  runAction(action.id, getActionFn(action.id))
                                }
                                shortcut={action.shortcut}
                                title={action.title(theme)}
                                value={`recent-action-${recent.id}`}
                              />
                            );
                          }

                          if (recent.kind === "event") {
                            const event = eventById.get(recent.id);
                            if (!event) return null;
                            return (
                              <Item
                                icon={<Calendar size={16} strokeWidth={1.75} />}
                                key={`recent-event-${event.id}`}
                                onSelect={() => runEvent(event)}
                                sub={formatEventDate(event)}
                                title={event.title}
                                value={`recent-event-${event.id}`}
                              />
                            );
                          }

                          const tag = tagById.get(recent.id);
                          if (!tag) return null;
                          return (
                            <Item
                              icon={
                                <span
                                  className={styles.tagDot}
                                  style={{ backgroundColor: tag.color }}
                                />
                              }
                              key={`recent-tag-${tag.id}`}
                              onSelect={() => runTag(tag)}
                              title={tag.name}
                              value={`recent-tag-${tag.id}`}
                            />
                          );
                        })}
                      </Command.Group>
                    ) : null}

                    {showActions ? (
                      <Command.Group heading="Acciones" className={styles.heading}>
                        <Item
                          icon={<Plus size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("create-event", onCreateEvent)}
                          shortcut={["⌘", "N"]}
                          title="Crear evento"
                          value="action-create-event"
                          keywords={["nuevo", "bloque", "añadir"]}
                        />
                        <Item
                          icon={<Sparkles size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("import", onImport)}
                          shortcut={["⌘", "⇧", "V"]}
                          title="Importar planning"
                          value="action-import"
                          keywords={["importar", "pegar", "json", "narrativo"]}
                        />
                        <Item
                          icon={<LayoutGrid size={16} strokeWidth={1.75} />}
                          onSelect={() =>
                            runAction("view-month", () => onSetViewMode("month"))
                          }
                          shortcut={["⌘", "1"]}
                          title="Cambiar a vista mensual"
                          value="action-view-month"
                          keywords={["mes", "calendario"]}
                        />
                        <Item
                          icon={<CalendarDays size={16} strokeWidth={1.75} />}
                          onSelect={() =>
                            runAction("view-week", () => onSetViewMode("week"))
                          }
                          shortcut={["⌘", "2"]}
                          title="Cambiar a vista semanal"
                          value="action-view-week"
                          keywords={["semana", "calendario"]}
                        />
                        <Item
                          icon={<Clock size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("go-today", onGoToday)}
                          shortcut={["⌘", "T"]}
                          title="Ir a Hoy"
                          value="action-go-today"
                          keywords={["hoy", "today"]}
                        />
                        <Item
                          icon={<Inbox size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("go-inbox", onGoInbox)}
                          title="Ir a Inbox"
                          value="action-go-inbox"
                          keywords={["bandeja", "inbox", "pendientes"]}
                        />
                        <Item
                          icon={<Calendar size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("go-calendar", onGoCalendar)}
                          title="Ir al Calendario"
                          value="action-go-calendar"
                          keywords={["calendario", "vista"]}
                        />
                        <Item
                          icon={
                            theme === "dark" ? (
                              <Sun size={16} strokeWidth={1.75} />
                            ) : (
                              <Moon size={16} strokeWidth={1.75} />
                            )
                          }
                          onSelect={() =>
                            runAction("toggle-theme", onToggleTheme)
                          }
                          shortcut={["⌘", "D"]}
                          title={
                            theme === "dark"
                              ? "Cambiar a tema claro"
                              : "Cambiar a tema oscuro"
                          }
                          value="action-toggle-theme"
                          keywords={["tema", "claro", "oscuro", "dark", "light"]}
                        />
                        <Item
                          icon={<TagIcon size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("create-tag", onCreateTag)}
                          title="Crear etiqueta nueva"
                          value="action-create-tag"
                          keywords={["etiqueta", "tag", "proyecto"]}
                        />
                        <Item
                          icon={<Focus size={16} strokeWidth={1.75} />}
                          onSelect={() => runAction("focus-mode", onFocusMode)}
                          shortcut={["⌘", "⇧", "F"]}
                          title="Modo Focus"
                          value="action-focus-mode"
                          keywords={["focus", "concentración", "widget"]}
                        />
                      </Command.Group>
                    ) : null}

                    {showEvents && events.length > 0 ? (
                      <Command.Group heading="Eventos" className={styles.heading}>
                        {events.slice(0, 80).map((event) => {
                          const tag = tagById.get(event.tagId ?? "");
                          const tokens = [
                            event.title,
                            event.description ?? "",
                            tag?.name ?? "",
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <Item
                              icon={
                                tag ? (
                                  <span
                                    className={styles.tagDot}
                                    style={{ backgroundColor: tag.color }}
                                  />
                                ) : (
                                  <Calendar size={16} strokeWidth={1.75} />
                                )
                              }
                              key={`event-${event.id}`}
                              onSelect={() => runEvent(event)}
                              sub={formatEventDate(event)}
                              title={event.title}
                              value={`event-${event.id}-${tokens}`}
                            />
                          );
                        })}
                      </Command.Group>
                    ) : null}

                    {showTags && tags.length > 0 ? (
                      <Command.Group heading="Etiquetas" className={styles.heading}>
                        {tags.map((tag) => (
                          <Item
                            icon={
                              <span
                                className={styles.tagDot}
                                style={{ backgroundColor: tag.color }}
                              />
                            }
                            key={`tag-${tag.id}`}
                            onSelect={() => runTag(tag)}
                            title={tag.name}
                            value={`tag-${tag.id}-${tag.name}`}
                          />
                        ))}
                      </Command.Group>
                    ) : null}
                  </>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  function getActionFn(id: ActionId): () => void {
    switch (id) {
      case "create-event":
        return onCreateEvent;
      case "import":
        return onImport;
      case "view-month":
        return () => onSetViewMode("month");
      case "view-week":
        return () => onSetViewMode("week");
      case "go-today":
        return onGoToday;
      case "go-inbox":
        return onGoInbox;
      case "go-calendar":
        return onGoCalendar;
      case "toggle-theme":
        return onToggleTheme;
      case "create-tag":
        return onCreateTag;
      case "focus-mode":
        return onFocusMode;
    }
  }
}

interface ActionDefinition {
  id: ActionId;
  Icon: typeof Plus;
  title: (theme: "light" | "dark") => string;
  shortcut?: string[];
}

const ACTION_DEFINITIONS: ActionDefinition[] = [
  { id: "create-event", Icon: Plus, title: () => "Crear evento", shortcut: ["⌘", "N"] },
  { id: "import", Icon: Sparkles, title: () => "Importar planning", shortcut: ["⌘", "⇧", "V"] },
  { id: "view-month", Icon: LayoutGrid, title: () => "Cambiar a vista mensual", shortcut: ["⌘", "1"] },
  { id: "view-week", Icon: CalendarDays, title: () => "Cambiar a vista semanal", shortcut: ["⌘", "2"] },
  { id: "go-today", Icon: Clock, title: () => "Ir a Hoy", shortcut: ["⌘", "T"] },
  { id: "go-inbox", Icon: Inbox, title: () => "Ir a Inbox" },
  { id: "go-calendar", Icon: Calendar, title: () => "Ir al Calendario" },
  {
    id: "toggle-theme",
    Icon: Moon,
    title: (theme) =>
      theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro",
    shortcut: ["⌘", "D"],
  },
  { id: "create-tag", Icon: Hash, title: () => "Crear etiqueta nueva" },
  {
    id: "focus-mode",
    Icon: Focus,
    title: () => "Modo Focus",
    shortcut: ["⌘", "⇧", "F"],
  },
];

interface FreeTextSectionProps {
  parsed: QuickCommandResult | null;
  rawText: string;
  onConfirm: () => void;
}

function FreeTextSection({ parsed, rawText, onConfirm }: FreeTextSectionProps) {
  if (!rawText) {
    return (
      <div className={styles.empty}>
        Escribe algo como "Repaso DevOps mañana 10:00 1h" y pulsa Enter.
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className={styles.empty}>
        No se ha podido detectar un título. Sigue escribiendo…
      </div>
    );
  }

  return (
    <Command.Group heading="Crear evento" className={styles.heading}>
      <Command.Item
        className={styles.item}
        onSelect={onConfirm}
        value={`quick-create-${rawText}`}
      >
        <span className={styles.itemIcon}>
          <Plus size={16} strokeWidth={1.75} />
        </span>
        <span className={styles.itemBody}>
          <span className={styles.itemTitle}>Crear "{parsed.title}"</span>
          <span className={styles.itemSub}>
            {parsed.date} · {parsed.startTime} · {parsed.durationMinutes} min
          </span>
        </span>
        <Shortcut keys={["↵"]} />
      </Command.Item>
      <div className={styles.commandPreview}>
        <div className={styles.commandPreviewRow}>
          <span className={styles.commandPreviewLabel}>Título</span>
          <span className={styles.commandPreviewValue}>{parsed.title}</span>
        </div>
        <div className={styles.commandPreviewRow}>
          <span className={styles.commandPreviewLabel}>Fecha</span>
          <span className={styles.commandPreviewValue}>
            {parsed.date}
            {parsed.hasExplicitDate ? "" : " (hoy por defecto)"}
          </span>
        </div>
        <div className={styles.commandPreviewRow}>
          <span className={styles.commandPreviewLabel}>Hora</span>
          <span className={styles.commandPreviewValue}>
            {parsed.startTime}
            {parsed.hasExplicitTime ? "" : " (por defecto)"}
          </span>
        </div>
        <div className={styles.commandPreviewRow}>
          <span className={styles.commandPreviewLabel}>Duración</span>
          <span className={styles.commandPreviewValue}>
            {parsed.durationMinutes} min
          </span>
        </div>
      </div>
      <p className={styles.commandHint}>
        Pulsa Enter para crear. Acepta "hoy", "mañana", días de la semana, fecha
        ISO o DD/MM, HH:MM y duración (1h, 30min, 1h30…).
      </p>
    </Command.Group>
  );
}
