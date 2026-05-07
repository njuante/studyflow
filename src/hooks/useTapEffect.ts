import { useMotionPresets } from "../lib/motion";

export function useTapEffect() {
  const { springs } = useMotionPresets();
  return {
    whileTap: { scale: 0.97 },
    whileHover: { scale: 1.02 },
    transition: springs.snappy,
  };
}
