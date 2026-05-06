import { useEffect, type ReactNode } from "react";

import styles from "./ContextMenu.module.css";

interface ContextMenuProps {
  x: number;
  y: number;
  children: ReactNode;
  onClose: () => void;
}

export function ContextMenu({ children, onClose, x, y }: ContextMenuProps) {
  useEffect(() => {
    function handlePointerDown() {
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={styles.menu}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}
