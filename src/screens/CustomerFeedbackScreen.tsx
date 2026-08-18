import { AppShell } from "@/components/shell/AppShell";
import { useApp } from "@/app/context";
// BACKEND: data flows through src/lib/data/feedback. Public submissions
// come in via submit_feedback() from the /feedback page, this screen only
// reads (view:reports, same as the rest of Insights).
import {
  useFeedbackStats,
  useFeedbackDistribution,
  useFeedbackMonthly,
  useFeedbackList,
} from "@/lib/data/hooks/feedback";
import { Pill, SectionCard, StatCard } from "@/components/ui/data-bits";
import { Button } from "@/components/ui/button";
import { num } from "@/lib/format";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { KPISkeleton, SectionSkeleton, TableSkeleton } from "@/components/ui/Skeletons";

const FEEDBACK_PAGE_SIZE = 25;

const RATING_TYPE_LABEL: Record<string, { sw: string; en: string }> = {
  loved: { sw: "Nilipenda", en: "Loved it" },
  okay: { sw: "Kawaida", en: "Okay" },
  not_good: { sw: "Sikupenda", en: "Not good" },
};

export function CustomerFeedbackScreen() {
  const { t, lang } = useApp();
  const [page, setPage] = useState(0);
  const { data: stats, isPending: statsPending } = useFeedbackStats();
  const { data: distribution = [] } = useFeedbackDistribution();
  const { data: monthly = [] } = useFeedbackMonthly();
  const { data: entries = [], isPending: entriesPending } = useFeedbackList(
    page,
    FEEDBACK_PAGE_SIZE,
  );

  const trendPct =
    stats && stats.prior7Days > 0
      ? Math.round(((stats.last7Days - stats.prior7Days) / stats.prior7Days) * 100)
      : null;
  const maxDistribution = Math.max(1, ...distribution.map((d) => d.count));
  const monthlyChart = [...monthly].reverse().map((m) => ({
    label: new Date(`${m.month}T00:00:00`).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
      month: "short",
    }),
    rating: m.avgRating,
  }));

  if (statsPending) {
    return (
      <AppShell title={t("Maoni ya wateja", "Customer feedback")}>
        <KPISkeleton />
        <div className="mt-5">
          <SectionSkeleton>
            <TableSkeleton rows={6} cols={4} />
          </SectionSkeleton>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Maoni ya wateja", "Customer feedback")}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          label={t("Jumla ya maoni", "Total reviews")}
          value={num(stats?.totalReviews ?? 0)}
          accent="green"
        />
        <StatCard
          label={t("Wastani wa nyota", "Average rating")}
          value={`${(stats?.averageRating ?? 0).toFixed(1)} / 5`}
          accent="info"
        />
        <StatCard
          label={t("Nyota 5", "5-star reviews")}
          value={`${(stats?.fiveStarPct ?? 0).toFixed(0)}%`}
          accent="amber"
        />
        <StatCard
          label={t("Mwenendo wa wiki", "Weekly trend")}
          value={trendPct === null ? "·" : `${trendPct > 0 ? "+" : ""}${trendPct}%`}
          sub={t("Ikilinganishwa na wiki iliyopita", "vs the prior week")}
          accent={trendPct === null ? "info" : trendPct >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <SectionCard title={t("Mgawanyo wa nyota", "Rating distribution")}>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((r) => {
              const count = distribution.find((d) => d.rating === r)?.count ?? 0;
              return (
                <div key={r} className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-0.5 w-10 shrink-0 font-num">
                    {r} <Star className="h-3 w-3" fill="#E5A100" color="#E5A100" />
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / maxDistribution) * 100}%`,
                        background: "linear-gradient(90deg, #1E7C3F, #8CC63F)",
                      }}
                    />
                  </div>
                  <span className="font-num text-xs text-muted-foreground w-8 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title={t("Mwenendo wa mwezi", "Monthly trend")} className="lg:col-span-2">
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={monthlyChart}>
                <CartesianGrid stroke="#E6EBE1" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#6B776E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#6B776E"
                  fontSize={11}
                  domain={[0, 5]}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="#1E7C3F"
                  strokeWidth={2}
                  dot={{ fill: "#2F9E44", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t("Maoni yote", "All reviews")}>
        {entriesPending ? (
          <TableSkeleton rows={5} cols={4} />
        ) : entries.length === 0 ? (
          <EmptyState title={t("Hakuna maoni bado", "No feedback yet")} />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className="h-3.5 w-3.5"
                            fill={n <= e.rating ? "#E5A100" : "none"}
                            color={n <= e.rating ? "#E5A100" : "#C9D1C4"}
                          />
                        ))}
                      </div>
                      <Pill
                        tone={
                          e.ratingType === "loved"
                            ? "success"
                            : e.ratingType === "okay"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {t(RATING_TYPE_LABEL[e.ratingType].sw, RATING_TYPE_LABEL[e.ratingType].en)}
                      </Pill>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {e.feedback && <div className="text-sm mt-1.5">{e.feedback}</div>}
                  {(e.name || e.location) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {[e.name, e.location].filter(Boolean).join(", ")}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {(page > 0 || entries.length === FEEDBACK_PAGE_SIZE) && (
              <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {t(`Ukurasa ${page + 1}`, `Page ${page + 1}`)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={entries.length < FEEDBACK_PAGE_SIZE}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </AppShell>
  );
}
