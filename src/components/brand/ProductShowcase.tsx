import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-local-storage";

// Auto-load every product photo dropped into src/assets/allProd/*.
// Add images there and they appear here with no code change. Filenames
// (without extension) become the on-image caption, e.g. "fresh-milk.jpg"
// shows "Fresh milk".
const productImages = import.meta.glob("@/assets/allProd/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function prettifyName(path: string) {
  const file = path.split("/").pop() ?? "";
  const base = file.replace(/\.[^.]+$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Branded gradient placeholders used when no real photos exist yet, so the
// showcase still looks intentional. Replaced automatically once images land.
const PLACEHOLDERS = [
  { name: "Fresh milk", emoji: "🥛", grad: "linear-gradient(135deg, #1E7C3F, #2F9E44)" },
  { name: "Mtindi", emoji: "🥛", grad: "linear-gradient(135deg, #2F9E44, #6FBF59)" },
  { name: "Yoghurt", emoji: "🥤", grad: "linear-gradient(135deg, #6FBF59, #8CC63F)" },
  { name: "Cheese", emoji: "🧀", grad: "linear-gradient(135deg, #1D9E75, #2F9E44)" },
  { name: "Ghee", emoji: "🫙", grad: "linear-gradient(135deg, #E5A100, #8CC63F)" },
];

interface Props {
  /** Aspect ratio class, e.g. "aspect-[4/3]" or "aspect-square". */
  aspect?: string;
  className?: string;
  /** Auto-advance interval in ms. */
  interval?: number;
  /** Show the caption + dots overlay. */
  showCaption?: boolean;
  /** Rounded corners radius class. */
  rounded?: string;
}

export function ProductShowcase({
  aspect = "aspect-[4/3]",
  className,
  interval = 3500,
  showCaption = true,
  rounded = "rounded-2xl",
}: Props) {
  const slides = useMemo(() => {
    const real = Object.entries(productImages).map(([path, url]) => ({
      kind: "image" as const,
      url,
      name: prettifyName(path),
    }));
    if (real.length) return real;
    return PLACEHOLDERS.map((p) => ({ kind: "placeholder" as const, ...p }));
  }, []);

  const [idx, setIdx] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (slides.length <= 1) return;
    if (reduced) return; // honor prefers-reduced-motion, no auto-rotation
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(id);
  }, [slides.length, interval, reduced]);

  const current = slides[idx];

  return (
    <div className={cn("relative overflow-hidden bg-secondary/40", aspect, rounded, className)}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute inset-0"
        >
          {current.kind === "image" ? (
            // Clean, fully visible image, only a soft bottom scrim for the caption.
            <img
              src={current.url}
              alt={current.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="h-full w-full grid place-items-center"
              style={{ background: current.grad }}
            >
              <span className="text-6xl drop-shadow-sm">{current.emoji}</span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {showCaption && (
        <>
          {/* Soft scrim only at the very bottom so the product stays clearly visible */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="text-white font-display font-semibold text-sm drop-shadow"
              >
                {current.name}
              </motion.div>
            </AnimatePresence>
            <div className="flex gap-1">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
