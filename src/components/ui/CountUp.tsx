import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => (format ? format(v) : Math.round(v).toLocaleString()));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}
