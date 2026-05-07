import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { useTags } from "../../hooks/useTags";
import { updateEvent } from "../../lib/api";
import type { StudyEvent } from "../../types";
import styles from "./EventTagMenu.module.css";

interface EventTagMenuProps {
  event: StudyEvent;
  onChanged: (event: StudyEvent) => void;
  onEdit?: (event: StudyEvent) => void;
  onDelete?: (event: StudyEvent) => void;
}

export function EventTagMenu({
  event,
  onChanged,
  onDelete,
  onEdit,
}: EventTagMenuProps) {
  const { tags } = useTags();
  const [open, setOpen] = useState(false);

  async function changeTag(tagId: string | null) {
    setOpen(false);
    const updated = await updateEvent({
      ...event,
      tagId,
      updatedAt: new Date().toISOString(),
    });
    onChanged(updated);
  }

  return (
    <div className={styles.wrap} onClick={(clickEvent) => clickEvent.stopPropagation()}>
      <button
        aria-label="Mas acciones"
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MoreHorizontal size={15} strokeWidth={1.75} />
      </button>

      {open ? (
        <div className={styles.menu}>
          {onEdit ? (
            <button
              onClick={() => {
                setOpen(false);
                onEdit(event);
              }}
              type="button"
            >
              Editar
            </button>
          ) : null}
          {onDelete ? (
            <button
              data-danger="true"
              onClick={() => {
                setOpen(false);
                onDelete(event);
              }}
              type="button"
            >
              Eliminar
            </button>
          ) : null}
          <div className={styles.groupLabel}>Cambiar etiqueta</div>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => void changeTag(tag.id)}
              type="button"
            >
              <span
                className={styles.dot}
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          ))}
          <button onClick={() => void changeTag(null)} type="button">
            <span className={styles.dotNeutral} />
            Sin etiqueta
          </button>
        </div>
      ) : null}
    </div>
  );
}
