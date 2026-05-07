import { motion, useAnimationControls } from "framer-motion";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useMotionPresets } from "../../lib/motion";

interface CompletionEffectProps {
  completed: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const PULSE_BG = "rgba(46, 204, 113, 0.2)";

export function CompletionEffect({
  completed,
  children,
  className,
  style,
}: CompletionEffectProps) {
  const wrapperControls = useAnimationControls();
  const pulseControls = useAnimationControls();
  const previousRef = useRef(completed);
  const { reduced } = useMotionPresets();

  useEffect(() => {
    const wasCompleted = previousRef.current;
    previousRef.current = completed;

    if (wasCompleted === completed) return;

    if (!completed) {
      void wrapperControls.start({
        opacity: 1,
        scale: 1,
        transition: { duration: 0.18 },
      });
      void pulseControls.start({ opacity: 0, transition: { duration: 0.15 } });
      return;
    }

    if (reduced) {
      void wrapperControls.start({ opacity: 0.4, transition: { duration: 0 } });
      return;
    }

    void wrapperControls.start({
      scale: [1, 1.05, 1],
      opacity: [1, 1, 1, 0.4],
      transition: {
        duration: 0.6,
        times: [0, 0.33, 0.5, 1],
        ease: [0.22, 1, 0.36, 1],
      },
    });

    void pulseControls.start({
      opacity: [0, 1, 1, 0],
      transition: {
        duration: 0.6,
        times: [0, 0.18, 0.5, 1],
        ease: "easeOut",
      },
    });
  }, [completed, wrapperControls, pulseControls, reduced]);

  return (
    <motion.div
      animate={wrapperControls}
      className={className}
      data-completed={completed ? "true" : "false"}
      initial={false}
      style={{ position: "relative", ...style }}
    >
      <motion.span
        aria-hidden="true"
        animate={pulseControls}
        initial={{ opacity: 0 }}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: PULSE_BG,
          borderRadius: "inherit",
          pointerEvents: "none",
        }}
      />
      {children}
    </motion.div>
  );
}

interface StrikeThroughProps {
  active: boolean;
  children: ReactNode;
  className?: string;
}

export function StrikeThrough({ active, children, className }: StrikeThroughProps) {
  const { reduced } = useMotionPresets();
  const duration = reduced ? 0 : 0.25;

  return (
    <span className={className} style={{ position: "relative", display: "inline-block" }}>
      {children}
      <motion.span
        aria-hidden="true"
        animate={{ scaleX: active ? 1 : 0 }}
        initial={false}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: 1.5,
          background: "currentColor",
          opacity: 0.6,
          transformOrigin: "left center",
          pointerEvents: "none",
        }}
        transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
  );
}
