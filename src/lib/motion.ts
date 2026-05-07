import type { Transition } from "framer-motion";
import { useReducedMotion } from "framer-motion";

export const springs = {
  drop: { type: "spring", stiffness: 380, damping: 28, mass: 0.8 } as Transition,
  appear: { type: "spring", stiffness: 300, damping: 30, mass: 0.6 } as Transition,
  layout: { type: "spring", stiffness: 260, damping: 32, mass: 0.7 } as Transition,
  snappy: { type: "spring", stiffness: 500, damping: 30, mass: 0.4 } as Transition,
};

export const fades = {
  fast: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } as Transition,
  default: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as Transition,
  slow: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } as Transition,
};

const instantSprings = {
  drop: { duration: 0 } as Transition,
  appear: { duration: 0 } as Transition,
  layout: { duration: 0 } as Transition,
  snappy: { duration: 0 } as Transition,
};

const instantFades = {
  fast: { duration: 0 } as Transition,
  default: { duration: 0 } as Transition,
  slow: { duration: 0 } as Transition,
};

export function useMotionPresets() {
  const reduced = useReducedMotion();
  if (reduced) {
    return { springs: instantSprings, fades: instantFades, reduced: true as const };
  }
  return { springs, fades, reduced: false as const };
}
