import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

import { useTags } from "../../hooks/useTags";
import { createEvent, deleteEvent, updateEvent } from "../../lib/api";
import { toIsoDate } from "../../lib/dates";
import type { StudyEvent } from "../../types";
import styles from "./EventModal.module.css";

interface EventModalProps {
  open: boolean;
  event?: StudyEvent | null;
  initialDate?: Date | null;
  initialTime?: string | null;
  initialTagId?: string | null;
  onClose: () => void;
  onSaved: (event: StudyEvent, mode: "create" | "update") => void;
  onDeleted: (id: string) => void;
}

type EventFormState = {
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  tagId: string | null;
  type: StudyEvent["type"];
  priority: StudyEvent["priority"];
  description: string;
};

const DURATION_OPTIONS = [30, 60, 90, 120, 180];

const TYPE_OPTIONS: Array<{
  value: StudyEvent["type"];
  label: string;
}> = [
  { value: "theory", label: "Teoría" },
  { value: "practice", label: "Práctica" },
  { value: "review", label: "Repaso" },
  { value: "exam", label: "Examen" },
];

const PRIORITY_OPTIONS: Array<{
  value: StudyEvent["priority"];
  label: string;
}> = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
];

function buildInitialState(
  event?: StudyEvent | null,
  initialDate?: Date | null,
  initialTime?: string | null,
  initialTagId?: string | null,
): EventFormState {
  if (event) {
    return {
      title: event.title,
      date: event.date,
      startTime: event.startTime,
      durationMinutes: event.durationMinutes,
      tagId: event.tagId,
      type: event.type,
      priority: event.priority,
      description: event.description ?? "",
    };
  }

  return {
    title: "",
    date: initialDate ? toIsoDate(initialDate) : toIsoDate(new Date()),
    startTime: initialTime ?? "09:00",
    durationMinutes: 60,
    tagId: initialTagId ?? null,
    type: "theory",
    priority: "medium",
    description: "",
  };
}

function isValidDuration(value: number): boolean {
  return Number.isFinite(value) && value >= 5 && value <= 720;
}

export function EventModal({
  event,
  initialDate,
  initialTagId,
  initialTime,
  onClose,
  onDeleted,
  onSaved,
  open,
}: EventModalProps) {
  const { tags, getTagById } = useTags();
  const [form, setForm] = useState<EventFormState>(() =>
    buildInitialState(event, initialDate, initialTime, initialTagId),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(buildInitialState(event, initialDate, initialTime, initialTagId));
    setIsSubmitting(false);
  }, [event, initialDate, initialTagId, initialTime, open]);

  const isEditMode = Boolean(event);
  const isValid =
    form.title.trim().length > 0 &&
    form.date.length > 0 &&
    form.startTime.length > 0 &&
    isValidDuration(form.durationMinutes);
  const selectedTag = useMemo(() => getTagById(form.tagId), [form.tagId, getTagById]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof EventFormState>(
    field: K,
    value: EventFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    const nextEvent: StudyEvent = event
      ? {
          ...event,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          date: form.date,
          startTime: form.startTime,
          durationMinutes: form.durationMinutes,
          tagId: form.tagId,
          type: form.type,
          priority: form.priority,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          date: form.date,
          startTime: form.startTime,
          durationMinutes: form.durationMinutes,
          tagId: form.tagId,
          type: form.type,
          priority: form.priority,
          createdAt: now,
          updatedAt: now,
          scheduled: true,
          completed: false,
          completedAt: null,
        };

    try {
      const savedEvent = event
        ? await updateEvent(nextEvent)
        : await createEvent(nextEvent);
      onSaved(savedEvent, event ? "update" : "create");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!event) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteEvent(event.id);
      onDeleted(event.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <header className={styles.header}>
          <input
            className={styles.titleInput}
            onChange={(changeEvent) => updateField("title", changeEvent.target.value)}
            placeholder="Título del bloque"
            value={form.title}
          />
          <button className={styles.closeButton} onClick={onClose} type="button">
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Fecha</span>
              <input
                className={styles.input}
                onChange={(changeEvent) => updateField("date", changeEvent.target.value)}
                type="date"
                value={form.date}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Hora inicio</span>
              <input
                className={styles.input}
                onChange={(changeEvent) =>
                  updateField("startTime", changeEvent.target.value)
                }
                type="time"
                value={form.startTime}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Duración</span>
              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  onChange={(changeEvent) =>
                    updateField("durationMinutes", Number(changeEvent.target.value))
                  }
                  value={form.durationMinutes}
                >
                  {DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Etiqueta</span>
              <div className={styles.selectWrap}>
                <span
                  aria-hidden="true"
                  className={styles.projectDot}
                  style={{ backgroundColor: selectedTag?.color ?? "#8e8e93" }}
                />
                <select
                  className={`${styles.select} ${styles.projectSelect}`}
                  onChange={(changeEvent) =>
                    updateField("tagId", changeEvent.target.value || null)
                  }
                  value={form.tagId ?? ""}
                >
                  <option value="">Sin etiqueta</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className={styles.fieldHint}>
                {selectedTag?.name ?? "Se mostrará en gris neutro"}
              </span>
            </label>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Tipo</span>
            <div className={styles.segmented}>
              {TYPE_OPTIONS.map((option) => (
                <button
                  className={`${styles.segmentButton} ${
                    form.type === option.value ? styles.segmentActive : ""
                  }`}
                  key={option.value}
                  onClick={() => updateField("type", option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Prioridad</span>
            <div className={styles.segmented}>
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  className={`${styles.segmentButton} ${
                    form.priority === option.value ? styles.segmentActive : ""
                  }`}
                  key={option.value}
                  onClick={() => updateField("priority", option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Descripción</span>
            <textarea
              className={styles.textarea}
              onChange={(changeEvent) =>
                updateField("description", changeEvent.target.value)
              }
              placeholder="Notas, objetivo del bloque o recordatorios"
              value={form.description}
            />
          </label>

          {!isValid ? (
            <p className={styles.validation}>
              El título es obligatorio y la duración debe estar entre 5 y 720 min.
            </p>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button
            className={styles.deleteButton}
            disabled={!isEditMode || isSubmitting}
            onClick={handleDelete}
            type="button"
          >
            Eliminar
          </button>

          <div className={styles.footerActions}>
            <button
              className={styles.cancelButton}
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className={styles.saveButton}
              disabled={!isValid || isSubmitting}
              onClick={handleSave}
              type="button"
            >
              {isSubmitting
                ? isEditMode
                  ? "Guardando..."
                  : "Creando..."
                : "Guardar cambios"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
