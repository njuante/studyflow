import {
  Archive,
  BookOpen,
  Brain,
  Calendar,
  Code2,
  Database,
  Flag,
  Folder,
  Hash,
  Inbox,
  Plus,
  Server,
  Shield,
  Sparkles,
  Star,
  Sun,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { ContextMenu } from "../ContextMenu";
import { countEventsByTag } from "../../lib/api";
import { useTags } from "../../hooks/useTags";
import type { Tag } from "../../types";
import styles from "./Sidebar.module.css";

export type SidebarView = "today" | "calendar" | "inbox" | "archive";

interface SidebarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  onImportClick: () => void;
  onFilterTag: (tagId: string) => void;
  inboxCount: number;
}

interface NavItem {
  id: SidebarView;
  label: string;
  icon: LucideIcon;
}

type TagEditorState =
  | { mode: "create"; tag?: undefined }
  | { mode: "edit"; tag: Tag }
  | null;

interface ContextMenuState {
  tag: Tag;
  x: number;
  y: number;
}

interface DeleteConfirmState {
  tag: Tag;
  eventCount: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "today", label: "Hoy", icon: Sun },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "archive", label: "Archivo", icon: Archive },
];

const COLOR_PRESETS = [
  "#378ADD",
  "#34C759",
  "#FF9F0A",
  "#FFD60A",
  "#AF52DE",
  "#FF2D55",
  "#30B0C7",
  "#FF453A",
];

const ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: "BookOpen", label: "BookOpen", icon: BookOpen },
  { value: "Code2", label: "Code2", icon: Code2 },
  { value: "Shield", label: "Shield", icon: Shield },
  { value: "Server", label: "Server", icon: Server },
  { value: "Database", label: "Database", icon: Database },
  { value: "Brain", label: "Brain", icon: Brain },
  { value: "Target", label: "Target", icon: Target },
  { value: "Flag", label: "Flag", icon: Flag },
  { value: "Zap", label: "Zap", icon: Zap },
  { value: "Star", label: "Star", icon: Star },
  { value: "Folder", label: "Folder", icon: Folder },
  { value: "Hash", label: "Hash", icon: Hash },
];

const ICON_BY_NAME = new Map(ICON_OPTIONS.map((option) => [option.value, option.icon]));

export function Sidebar({
  activeView,
  onFilterTag,
  onImportClick,
  onViewChange,
  inboxCount,
}: SidebarProps) {
  const { createTag, deleteTag, tags, updateTag } = useTags();
  const [editor, setEditor] = useState<TagEditorState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  const isWindows =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("win");

  async function requestDelete(tag: Tag) {
    setContextMenu(null);
    const eventCount = await countEventsByTag(tag.id).catch(() => 0);
    setDeleteConfirm({ tag, eventCount });
  }

  async function confirmDelete() {
    if (!deleteConfirm) {
      return;
    }

    await deleteTag(deleteConfirm.tag.id);
    setDeleteConfirm(null);
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.section}>
        <p className={styles.sectionTitle}>Navegación</p>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ icon: Icon, id, label }) => {
            const showInboxBadge = id === "inbox" && inboxCount > 0;

            return (
              <button
                className={`${styles.navItem} ${
                  activeView === id ? styles.active : ""
                }`}
                key={id}
                onClick={() => onViewChange(id)}
                type="button"
              >
                <Icon size={14} strokeWidth={1.75} />
                <span className={styles.navLabel}>{label}</span>
                {showInboxBadge ? (
                  <span className={styles.inboxBadge}>{inboxCount}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className={`${styles.section} ${styles.tagsSection}`}>
        <div className={styles.sectionHeader}>
          <p className={styles.sectionTitle}>Etiquetas</p>
          <button
            aria-label="Crear etiqueta"
            className={styles.addTagButton}
            onClick={() => setEditor({ mode: "create" })}
            type="button"
          >
            <Plus size={12} strokeWidth={1.75} />
          </button>
        </div>

        <div className={styles.tags}>
          {tags.map((tag) => {
            const Icon = tag.icon ? ICON_BY_NAME.get(tag.icon) : null;

            return (
              <button
                className={styles.tagItem}
                key={tag.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ tag, x: event.clientX, y: event.clientY });
                }}
                onDoubleClick={() => setEditor({ mode: "edit", tag })}
                type="button"
              >
                {Icon ? (
                  <Icon
                    className={styles.tagIcon}
                    size={14}
                    strokeWidth={1.75}
                    style={{ color: tag.color }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className={styles.tagDot}
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span>{tag.name}</span>
              </button>
            );
          })}
        </div>

        {editor ? (
          <TagPopover
            mode={editor.mode}
            onClose={() => setEditor(null)}
            onCreate={createTag}
            onUpdate={updateTag}
            tag={editor.tag}
          />
        ) : null}
      </div>

      <div className={styles.importArea}>
        <button className={styles.importButton} onClick={onImportClick} type="button">
          <span className={styles.importLabel}>
            <Sparkles size={14} strokeWidth={1.75} />
            <span>Importar planning</span>
          </span>
          <kbd className={styles.shortcut}>
            {isWindows ? "Ctrl+Shift+V" : "⌘⇧V"}
          </kbd>
        </button>
      </div>

      {contextMenu ? (
        <ContextMenu
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          <button
            onClick={() => {
              setEditor({ mode: "edit", tag: contextMenu.tag });
              setContextMenu(null);
            }}
            type="button"
          >
            Editar
          </button>
          <button onClick={() => requestDelete(contextMenu.tag)} type="button" data-danger="true">
            Eliminar
          </button>
          <button
            onClick={() => {
              onFilterTag(contextMenu.tag.id);
              setContextMenu(null);
            }}
            type="button"
          >
            Filtrar calendario por esta etiqueta
          </button>
        </ContextMenu>
      ) : null}

      {deleteConfirm ? (
        <div className={styles.confirmOverlay} role="presentation">
          <div className={styles.confirmDialog} role="dialog" aria-modal="true">
            <p>
              ¿Eliminar "{deleteConfirm.tag.name}"? Los {deleteConfirm.eventCount} eventos
              asociados perderán la etiqueta pero no se borrarán.
            </p>
            <div className={styles.confirmActions}>
              <button onClick={() => setDeleteConfirm(null)} type="button">
                Cancelar
              </button>
              <button
                className={styles.dangerButton}
                onClick={confirmDelete}
                type="button"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface TagPopoverProps {
  mode: "create" | "edit";
  tag?: Tag;
  onCreate: (name: string, color: string, icon?: string) => Promise<Tag>;
  onUpdate: (id: string, name: string, color: string, icon?: string) => Promise<Tag>;
  onClose: () => void;
}

function TagPopover({
  mode,
  onClose,
  onCreate,
  onUpdate,
  tag,
}: TagPopoverProps) {
  const [name, setName] = useState(tag?.name ?? "");
  const [color, setColor] = useState(tag?.color ?? COLOR_PRESETS[0]);
  const [icon, setIcon] = useState(tag?.icon ?? "");
  const [showCustomColor, setShowCustomColor] = useState(
    Boolean(tag?.color && !COLOR_PRESETS.includes(tag.color)),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedIcon = useMemo(
    () => ICON_OPTIONS.find((option) => option.value === icon),
    [icon],
  );
  const SelectedIcon = selectedIcon?.icon;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "edit" && tag) {
        await onUpdate(tag.id, trimmedName, color, icon || undefined);
      } else {
        await onCreate(trimmedName, color, icon || undefined);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.popover} onSubmit={handleSubmit}>
      <label className={styles.popoverField}>
        <span>Nombre de la etiqueta</span>
        <input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>

      <div className={styles.popoverField}>
        <span>Color</span>
        <div className={styles.colorGrid}>
          {COLOR_PRESETS.map((preset) => (
            <button
              aria-label={`Color ${preset}`}
              className={`${styles.colorSwatch} ${
                color.toLowerCase() === preset.toLowerCase() ? styles.colorActive : ""
              }`}
              key={preset}
              onClick={() => {
                setColor(preset);
                setShowCustomColor(false);
              }}
              style={{ backgroundColor: preset }}
              type="button"
            />
          ))}
          <button
            className={styles.customColorButton}
            onClick={() => setShowCustomColor(true)}
            type="button"
          >
            Personalizado
          </button>
        </div>
        {showCustomColor ? (
          <input
            className={styles.colorInput}
            onChange={(event) => setColor(event.target.value)}
            type="color"
            value={color}
          />
        ) : null}
      </div>

      <label className={styles.popoverField}>
        <span>Icono</span>
        <div className={styles.iconSelectWrap}>
          {SelectedIcon ? (
            <SelectedIcon size={14} strokeWidth={1.75} />
          ) : (
            <span className={styles.emptyIconDot} />
          )}
          <select onChange={(event) => setIcon(event.target.value)} value={icon}>
            <option value="">Sin icono</option>
            {ICON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </label>

      <div className={styles.popoverActions}>
        <button disabled={isSubmitting} onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className={styles.primaryButton}
          disabled={!name.trim() || isSubmitting}
          type="submit"
        >
          {mode === "edit" ? "Guardar" : "Crear"}
        </button>
      </div>
    </form>
  );
}
