import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: customer feedback, brought in from the standalone feedback-form
// app so this is the one place it's managed. Public submission is the only
// anon path in this repository besides invoice verification, via
// submit_feedback(); everything else requires view:reports.

export type RatingType = "loved" | "okay" | "not_good";

export interface FeedbackEntry {
  id: string;
  createdAt: string;
  name: string | null;
  location: string | null;
  rating: number;
  feedback: string | null;
  ratingType: RatingType;
}

export interface FeedbackStats {
  totalReviews: number;
  averageRating: number;
  fiveStarPct: number;
  last7Days: number;
  prior7Days: number;
}

export interface RatingDistributionEntry {
  rating: number;
  count: number;
}

export interface FeedbackMonthEntry {
  month: string;
  avgRating: number;
  reviewCount: number;
}

interface FeedbackRow {
  id: string;
  created_at: string;
  name: string | null;
  location: string | null;
  rating: number;
  feedback: string | null;
  rating_type: RatingType;
}

function toEntry(r: FeedbackRow): FeedbackEntry {
  return {
    id: r.id,
    createdAt: r.created_at,
    name: r.name,
    location: r.location,
    rating: Number(r.rating),
    feedback: r.feedback,
    ratingType: r.rating_type,
  };
}

export const feedbackKeys = {
  all: ["feedback"] as const,
  list: (page: number) => ["feedback", "list", page] as const,
  stats: () => ["feedback", "stats"] as const,
  distribution: () => ["feedback", "distribution"] as const,
  monthly: () => ["feedback", "monthly"] as const,
};

export const feedbackRepo = {
  /** No auth: this is what the public /feedback page calls. */
  async submit(input: {
    rating: number;
    ratingType: RatingType;
    name?: string;
    location?: string;
    feedback?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc("submit_feedback", {
      p_rating: input.rating,
      p_rating_type: input.ratingType,
      p_name: input.name ?? null,
      p_location: input.location ?? null,
      p_feedback: input.feedback ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async list(page = 0, pageSize = 25): Promise<FeedbackEntry[]> {
    const rows = unwrap(
      await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1),
    ) as FeedbackRow[];
    return rows.map(toEntry);
  },

  async stats(): Promise<FeedbackStats | null> {
    const row = unwrap(await supabase.from("feedback_stats").select("*").maybeSingle()) as {
      total_reviews: number;
      average_rating: number | null;
      five_star_pct: number | null;
      last_7_days: number;
      prior_7_days: number;
    } | null;
    if (!row) return null;
    return {
      totalReviews: Number(row.total_reviews),
      averageRating: Number(row.average_rating ?? 0),
      fiveStarPct: Number(row.five_star_pct ?? 0),
      last7Days: Number(row.last_7_days),
      prior7Days: Number(row.prior_7_days),
    };
  },

  async ratingDistribution(): Promise<RatingDistributionEntry[]> {
    const rows = unwrap(await supabase.from("feedback_rating_distribution").select("*")) as {
      rating: number;
      count: number;
    }[];
    return rows.map((r) => ({ rating: Number(r.rating), count: Number(r.count) }));
  },

  async monthly(): Promise<FeedbackMonthEntry[]> {
    const rows = unwrap(await supabase.from("feedback_monthly").select("*")) as {
      month: string;
      avg_rating: number;
      review_count: number;
    }[];
    return rows.map((r) => ({
      month: r.month,
      avgRating: Number(r.avg_rating),
      reviewCount: Number(r.review_count),
    }));
  },
};
