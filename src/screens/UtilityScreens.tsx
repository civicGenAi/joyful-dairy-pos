import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { JoyLogo } from "@/components/brand/JoyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertOctagon,
  ArrowRight,
  Construction,
  Home,
  LifeBuoy,
  Lock,
  Search,
  ServerCrash,
  Truck,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/app/context";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";

function Shell({
  icon,
  code,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  code?: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-5">
          <JoyLogo />
        </div>
        <div
          className="mx-auto grid h-20 w-20 place-items-center rounded-3xl text-white mb-5 shadow-elevated"
          style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
        >
          {icon}
        </div>
        {code && <div className="font-display text-5xl font-bold brand-gradient-text">{code}</div>}
        <h1 className="font-display text-2xl font-bold mt-2">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{subtitle}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

// ---- 404: a lost milk delivery -------------------------------------------

/** Known app paths: typo suggestions ("/helth" → "/health") and quick links. */
const KNOWN_ROUTES: { path: string; sw: string; en: string }[] = [
  { path: "/dashboard", sw: "Dashibodi", en: "Dashboard" },
  { path: "/pos", sw: "Mauzo (POS)", en: "POS" },
  { path: "/farmers", sw: "Wafugaji", en: "Farmers" },
  { path: "/customers", sw: "Wateja", en: "Customers" },
  { path: "/products", sw: "Bidhaa", en: "Products" },
  { path: "/stock", sw: "Stock na Ghala", en: "Stock & Store" },
  { path: "/production", sw: "Uzalishaji", en: "Production" },
  { path: "/collection-points", sw: "Pointi", en: "Collection points" },
  { path: "/finance", sw: "Fedha", en: "Finance" },
  { path: "/expenses", sw: "Matumizi", en: "Expenses" },
  { path: "/reconciliation", sw: "Ulinganisho", en: "Reconciliation" },
  { path: "/reports", sw: "Ripoti", en: "Reports" },
  { path: "/settings", sw: "Mipangilio", en: "Settings" },
  { path: "/profile", sw: "Profaili", en: "Profile" },
  { path: "/help", sw: "Msaada", en: "Help" },
  { path: "/status", sw: "Afya ya mfumo", en: "System health" },
  { path: "/van", sw: "Gari la njia", en: "Route van" },
];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array<number>(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[m][n];
}

/** Deterministic drop positions so the SSR HTML matches the client exactly. */
const DROPS = [
  { left: 8, size: 14, delay: 0, duration: 7 },
  { left: 18, size: 9, delay: 1.8, duration: 9 },
  { left: 31, size: 16, delay: 0.6, duration: 8 },
  { left: 44, size: 8, delay: 2.6, duration: 10 },
  { left: 57, size: 13, delay: 1.2, duration: 7.5 },
  { left: 69, size: 10, delay: 3.4, duration: 9.5 },
  { left: 81, size: 15, delay: 0.3, duration: 8.5 },
  { left: 92, size: 9, delay: 2.1, duration: 7.8 },
];

function MilkBottle({ spilt }: { spilt: boolean }) {
  return (
    <svg viewBox="0 0 64 96" className="h-full w-auto" aria-hidden>
      <defs>
        <linearGradient id="milk404" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dcefe2" />
        </linearGradient>
      </defs>
      {/* cap */}
      <rect x="22" y="2" width="20" height="10" rx="3" fill="#8CC63F" />
      {/* bottle body */}
      <path
        d="M24 12 h16 v8 c8 6 10 12 10 22 v40 c0 7 -5 12 -12 12 H26 c-7 0 -12 -5 -12 -12 V42 c0 -10 2 -16 10 -22 z"
        fill="url(#milk404)"
        stroke="#1E7C3F"
        strokeWidth="2.5"
      />
      {/* milk level */}
      <path
        d={
          spilt
            ? "M16 88 h32 v0 c0 4 -4 6 -10 6 H26 c-6 0 -10 -2 -10 -6 z"
            : "M16 52 h32 v30 c0 7 -5 12 -12 12 H26 c-7 0 -12 -5 -12 -12 z"
        }
        fill="#f3fbf5"
        stroke="none"
        opacity="0.9"
      />
      {/* label */}
      <rect x="20" y="56" width="24" height="16" rx="4" fill="#1E7C3F" opacity={spilt ? 0.35 : 1} />
      <circle cx="32" cy="64" r="4.5" fill="#8CC63F" opacity={spilt ? 0.35 : 1} />
    </svg>
  );
}

export function NotFoundScreen() {
  const { t, lang } = useApp();
  const nav = useNavigate();
  const [typedPath, setTypedPath] = useState("");
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [q, setQ] = useState("");
  const [pokes, setPokes] = useState(0);
  const spilt = pokes >= 5;

  // The path that 404ed, read after mount (the server cannot know it safely).
  useEffect(() => {
    setTypedPath(window.location.pathname);
  }, []);

  const suggestion = useMemo(() => {
    if (!typedPath || typedPath === "/") return null;
    let best: { path: string; sw: string; en: string } | null = null;
    let bestDist = Infinity;
    for (const r of KNOWN_ROUTES) {
      const d = levenshtein(typedPath.toLowerCase(), r.path);
      if (d < bestDist) {
        bestDist = d;
        best = r;
      }
    }
    // Only suggest when it is plausibly a typo, not a totally unknown URL.
    return best && bestDist <= Math.max(2, Math.floor(best.path.length / 3)) ? best : null;
  }, [typedPath]);

  const goSearch = () => {
    if (q.trim()) nav({ to: "/search", search: { q: q.trim() } });
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "linear-gradient(160deg, #0c3a20 0%, #14532D 45%, #1E7C3F 100%)" }}
      onMouseMove={(e) =>
        setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
      }
    >
      {/* parallax glow blobs */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#8CC63F]/20 blur-3xl transition-transform duration-300"
        style={{ transform: `translate(${mouse.x * 30}px, ${mouse.y * 30}px)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl transition-transform duration-300"
        style={{ transform: `translate(${mouse.x * -40}px, ${mouse.y * -40}px)` }}
      />

      {/* floating milk drops */}
      {DROPS.map((d, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute rounded-full bg-white/70"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size * 1.25,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
          }}
          initial={{ top: "-5%", opacity: 0 }}
          animate={{ top: "105%", opacity: [0, 0.8, 0.8, 0] }}
          transition={{
            duration: d.duration,
            delay: d.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-14 text-center">
        <div className="mb-6">
          <JoyLogo size={44} showWordmark={false} />
        </div>

        {/* 4 [bottle] 4 */}
        <div className="flex items-end justify-center gap-2 select-none">
          <motion.span
            className="font-display text-[7rem] sm:text-[9rem] font-bold leading-none text-white/95"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 12 }}
          >
            4
          </motion.span>
          <motion.button
            type="button"
            aria-label={t("Chupa ya maziwa", "Milk bottle")}
            className="h-28 sm:h-36 cursor-pointer outline-none"
            initial={{ y: -60, opacity: 0, rotate: 0 }}
            animate={
              spilt
                ? { y: 10, opacity: 1, rotate: 86 }
                : { y: 0, opacity: 1, rotate: [0, -6, 6, -3, 0] }
            }
            transition={
              spilt
                ? { type: "spring", stiffness: 140, damping: 10 }
                : { duration: 0.8, delay: 0.15 }
            }
            whileHover={spilt ? {} : { scale: 1.08, rotate: -8 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setPokes((n) => n + 1)}
            title={spilt ? t("Imemwagika!", "Spilt!") : t("Nibonyeze...", "Poke me...")}
          >
            <MilkBottle spilt={spilt} />
          </motion.button>
          <motion.span
            className="font-display text-[7rem] sm:text-[9rem] font-bold leading-none text-white/95"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 12, delay: 0.25 }}
          >
            4
          </motion.span>
        </div>

        {/* spilt milk puddle */}
        {spilt && (
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            className="h-3 w-48 rounded-[50%] bg-white/80 blur-[1px]"
          />
        )}

        <motion.h1
          className="font-display text-2xl sm:text-3xl font-bold mt-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          {spilt
            ? t("Usilie maziwa yaliyomwagika!", "No use crying over spilt milk!")
            : t("Ukurasa huu umepotea njiani", "This page got lost on the route")}
        </motion.h1>
        <motion.p
          className="mt-2 max-w-md text-sm leading-relaxed text-white/75"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          {spilt
            ? t(
                "Hata hivyo, ukurasa bado haupo. Hebu tukusaidie kufika unakokwenda.",
                "The page still does not exist though. Let us get you where you were going.",
              )
            : t(
                "Gari la maziwa limeshindwa kuipata anwani hii. Inawezekana imeandikwa vibaya au imehamishwa.",
                "Our milk van could not find this address. It may be mistyped or it may have moved.",
              )}
        </motion.p>

        {/* did you mean */}
        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2.5 text-sm backdrop-blur"
          >
            <span className="text-white/70">
              {t("Ulimaanisha", "Did you mean")}{" "}
              <code className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-xs">
                {typedPath}
              </code>{" "}
              →
            </span>{" "}
            <Link
              to={suggestion.path}
              className="font-semibold text-[#cdeaa0] underline-offset-2 hover:underline"
            >
              {lang === "sw" ? suggestion.sw : suggestion.en} ({suggestion.path})
            </Link>
            ?
          </motion.div>
        )}

        {/* search anything */}
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6 flex w-full max-w-sm items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            goSearch();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Tafuta chochote kwenye mfumo…", "Search anything in the system…")}
              className="h-11 border-white/20 bg-white/10 pl-10 text-white placeholder:text-white/40 backdrop-blur focus-visible:ring-[#8CC63F]"
            />
          </div>
          <Button
            type="submit"
            className="h-11 rounded-xl px-4 text-white"
            style={{ background: "linear-gradient(135deg, #2F9E44, #8CC63F)" }}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.form>

        {/* quick destinations */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          <Button
            asChild
            className="h-9 rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #2F9E44, #8CC63F)" }}
          >
            <Link to="/dashboard">
              <Home className="mr-1.5 h-3.5 w-3.5" />
              {t("Dashibodi", "Dashboard")}
            </Link>
          </Button>
          {KNOWN_ROUTES.filter((r) =>
            ["/pos", "/farmers", "/customers", "/stock", "/reports"].includes(r.path),
          ).map((r) => (
            <Button
              key={r.path}
              asChild
              variant="outline"
              className="h-9 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            >
              <Link to={r.path}>{lang === "sw" ? r.sw : r.en}</Link>
            </Button>
          ))}
          <Button
            asChild
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
          >
            <Link to="/status">
              <LifeBuoy className="mr-1.5 h-3.5 w-3.5" />
              {t("Afya ya mfumo", "System health")}
            </Link>
          </Button>
        </motion.div>

        {!spilt && pokes > 0 && (
          <div className="mt-4 text-[11px] text-white/50">
            {t(
              `Bonyeza chupa mara ${5 - pokes} zaidi…`,
              `Poke the bottle ${5 - pokes} more time${5 - pokes === 1 ? "" : "s"}…`,
            )}
          </div>
        )}
      </div>

      {/* the lost delivery van, forever circling the bottom of the page */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6">
        <div className="mx-8 border-b-2 border-dashed border-white/20" />
        <motion.div
          className="absolute -top-7"
          initial={{ left: "-10%" }}
          animate={{ left: "110%" }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <div className="flex items-end gap-1 -scale-x-100">
            <Truck className="h-9 w-9 text-[#cdeaa0]" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function ForbiddenScreen() {
  const { t } = useApp();
  return (
    <Shell
      code="403"
      icon={<Lock className="h-9 w-9" />}
      title={t("Huna ruhusa", "You don't have access")}
      subtitle={t(
        "Jukumu lako haliruhusu ukurasa huu. Muulize Admin akupe ruhusa, au rudi kwenye sehemu unayoweza kutumia.",
        "Your role doesn't permit this screen. Ask an Admin to grant access, or head back to a place you can use.",
      )}
    >
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("Rudi kwenye dashibodi", "Back to dashboard")}</Link>
      </Button>
      <Button
        asChild
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        <Link to="/settings">{t("Omba ruhusa", "Request access")}</Link>
      </Button>
    </Shell>
  );
}

export function ServerErrorScreen() {
  const { t } = useApp();
  const router = useRouter();
  return (
    <Shell
      code="500"
      icon={<ServerCrash className="h-9 w-9" />}
      title={t("Kuna tatizo", "Something went wrong")}
      subtitle={t(
        "Timu yetu imearifiwa. Jaribu tena baada ya muda, au rudi kwenye dashibodi.",
        "Our team has been notified. Try again in a moment, or return to the dashboard.",
      )}
    >
      <Button
        onClick={() => router.invalidate()}
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        {t("Jaribu tena", "Try again")}
      </Button>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("Rudi kwenye dashibodi", "Back to dashboard")}</Link>
      </Button>
    </Shell>
  );
}

export function MaintenanceScreen() {
  const { t } = useApp();
  return (
    <Shell
      icon={<Construction className="h-9 w-9" />}
      title={t("Tunaboresha mfumo", "We're upgrading the system")}
      subtitle={t(
        "African Joy POS iko kwenye matengenezo mafupi. Tutarudi mtandaoni hivi karibuni. Asante kwa subira.",
        "African Joy POS is under brief maintenance. We'll be back online shortly. Thanks for your patience.",
      )}
    >
      <Button asChild variant="outline">
        <Link to="/status">{t("Tazama hali", "View status")}</Link>
      </Button>
    </Shell>
  );
}

export function OfflineScreen() {
  const { t } = useApp();
  return (
    <Shell
      icon={<WifiOff className="h-9 w-9" />}
      title={t("Huna mtandao", "You're offline")}
      subtitle={t(
        "Mauzo na ukusanyaji unaorekodi kwenye gari la njia vinahifadhiwa kwenye simu na vitasawazishwa moja kwa moja mtandao ukirudi.",
        "Sales and collections you record on the route module are saved on this device and will sync automatically when the connection returns.",
      )}
    >
      <Button
        onClick={() => window.location.reload()}
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        {t("Jaribu tena muunganisho", "Retry connection")}
      </Button>
      <Button asChild variant="outline">
        <Link to="/van">{t("Endelea bila mtandao", "Continue offline")}</Link>
      </Button>
    </Shell>
  );
}

export function GenericErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useApp();
  return (
    <Shell
      icon={<AlertOctagon className="h-9 w-9" />}
      title={t("Ukurasa huu umekutana na tatizo", "This page hit a snag")}
      subtitle={
        error?.message ||
        t(
          "Hitilafu isiyotarajiwa imetokea wakati wa kuonyesha ukurasa.",
          "An unexpected error occurred while rendering this screen.",
        )
      }
    >
      <Button
        onClick={reset}
        className="text-white"
        style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
      >
        {t("Jaribu tena", "Try again")}
      </Button>
      <Button asChild variant="outline">
        <Link to="/dashboard">{t("Rudi kwenye dashibodi", "Back to dashboard")}</Link>
      </Button>
    </Shell>
  );
}
