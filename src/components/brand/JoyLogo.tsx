export function JoyLogo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="African Joy Dairy">
      <div
        className="relative grid place-items-center rounded-full text-white shadow-card"
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
          <path d="M5 8c0-1.5 2-3 7-3s7 1.5 7 3-2 3-7 3-7-1.5-7-3z" fill="#14532D" opacity=".15" />
        </svg>
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-wider text-white"
          style={{ background: "#E11B22" }}
        >
          Joy
        </span>
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-bold text-foreground">African Joy</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Dairy · Arusha
        </div>
      </div>
    </div>
  );
}
