import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-local-storage";

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const reduced = usePrefersReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(mv, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [value, mv, reduced]);
  return <motion.span>{rounded}</motion.span>;
}
