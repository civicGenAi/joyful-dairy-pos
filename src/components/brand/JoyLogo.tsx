import { cn } from "@/lib/utils";

// Pick up a real logo dropped into src/assets/logo.{png,jpg,jpeg,svg,webp}.
// If no file is present yet, we fall back to the inline brand mark below so
// the app never breaks at build time.
const logoMatches = import.meta.glob("@/assets/logo.{png,jpg,jpeg,svg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const REAL_LOGO_URL: string | undefined = Object.values(logoMatches)[0];

interface Props {
  size?: number;
  /** Show "African Joy / Dairy · Arusha" wordmark next to the avatar. */
  showWordmark?: boolean;
  className?: string;
  /** Force-use the inline SVG even if a real logo file is present. */
  inlineOnly?: boolean;
}

export function JoyLogo({ size = 36, showWordmark = true, className, inlineOnly = false }: Props) {
  const useReal = !inlineOnly && !!REAL_LOGO_URL;
  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="African Joy Dairy">
      {useReal ? (
        <img
          src={REAL_LOGO_URL}
          alt="African Joy Dairy"
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="rounded-full object-contain shrink-0"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="relative grid place-items-center rounded-full text-white shadow-card shrink-0"
          style={{
            width: size,
            height: size,
            background: "linear-gradient(135deg, #1E7C3F 0%, #2F9E44 45%, #8CC63F 100%)",
          }}
        >
          <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 8c0-1.5 2-3 7-3s7 1.5 7 3v8c0 1.5-2 3-7 3s-7-1.5-7-3V8z"
              fill="white"
              opacity=".95"
            />
            <path
              d="M5 8c0-1.5 2-3 7-3s7 1.5 7 3-2 3-7 3-7-1.5-7-3z"
              fill="#14532D"
              opacity=".15"
            />
          </svg>
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wider text-white"
            style={{ background: "#E11B22" }}
          >
            Joy
          </span>
        </div>
      )}
      {showWordmark && (
        <div className="leading-tight min-w-0">
          <div className="font-display text-[15px] font-bold text-foreground truncate">
            African Joy
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground truncate">
            Dairy · Arusha
          </div>
        </div>
      )}
    </div>
  );
}
