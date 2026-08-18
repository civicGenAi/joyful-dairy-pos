import { JoyLogo } from "@/components/brand/JoyLogo";
import { useApp } from "@/app/context";
import { useSubmitFeedback } from "@/lib/data/hooks/feedback";
import type { RatingType } from "@/lib/data/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Star, Smile, Meh, Frown, CheckCircle2 } from "lucide-react";
import { useState } from "react";

// Public, no login: this is what a customer scans a QR code to reach.
// Brought in from the standalone feedback-form app so submissions land in
// the same database everything else does, backed by submit_feedback(), the
// other anon-callable RPC in this schema besides invoice verification.

const RATING_TYPES: { id: RatingType; icon: typeof Smile; label: { sw: string; en: string } }[] = [
  { id: "loved", icon: Smile, label: { sw: "Nilipenda", en: "Loved it" } },
  { id: "okay", icon: Meh, label: { sw: "Kawaida", en: "It was okay" } },
  { id: "not_good", icon: Frown, label: { sw: "Sikupenda", en: "Not good" } },
];

export function FeedbackFormScreen() {
  const { t } = useApp();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingType, setRatingType] = useState<RatingType | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [comment, setComment] = useState("");
  const submit = useSubmitFeedback();

  const canSubmit = rating > 0 && !!ratingType;

  const save = () => {
    if (!canSubmit || !ratingType) return;
    submit.mutate({
      rating,
      ratingType,
      name: name || undefined,
      location: location || undefined,
      feedback: comment || undefined,
    });
  };

  if (submit.isSuccess) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-sm w-full text-center">
          <div className="flex justify-center mb-6">
            <JoyLogo />
          </div>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#DFF0E4] text-[#2C7A4B] mb-5 shadow-elevated">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#2C7A4B]">
            {t("Asante kwa maoni yako!", "Thank you for your feedback!")}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t(
              "Tunathamini muda wako, itatusaidia kuboresha huduma zetu.",
              "We appreciate your time, it helps us improve.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-6">
          <JoyLogo />
        </div>
        <h1 className="font-display text-lg font-bold text-center">
          {t("Tupe maoni yako", "Tell us what you think")}
        </h1>
        <p className="text-muted-foreground text-sm text-center mt-1 mb-6">
          {t(
            "Maoni yako yanatusaidia kuboresha bidhaa na huduma zetu.",
            "Your feedback helps us improve our products and service.",
          )}
        </p>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
              {t("Ungependeza kutupatia nyota ngapi?", "How many stars would you give us?")}
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  aria-label={`${n} star`}
                >
                  <Star
                    className="h-8 w-8 transition"
                    fill={n <= (hoverRating || rating) ? "#E5A100" : "none"}
                    color={n <= (hoverRating || rating) ? "#E5A100" : "#C9D1C4"}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
              {t("Ilikuwaje kwa ujumla?", "How was it overall?")}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {RATING_TYPES.map((r) => {
                const Icon = r.icon;
                const active = ratingType === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRatingType(r.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-semibold transition ${
                      active
                        ? "border-[#1E7C3F] bg-[#1E7C3F]/10 text-[#1E7C3F]"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {t(r.label.sw, r.label.en)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Jina (hiari)", "Name (optional)")}
            />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("Mahali (hiari)", "Location (optional)")}
            />
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("Maoni yako (hiari)", "Your comment (optional)")}
            rows={3}
          />

          <Button
            className="w-full text-white"
            style={{ background: "linear-gradient(135deg, #1E7C3F, #8CC63F)" }}
            disabled={!canSubmit || submit.isPending}
            onClick={save}
          >
            {submit.isPending ? t("Inatuma…", "Sending…") : t("Tuma maoni", "Send feedback")}
          </Button>
        </div>
      </div>
    </div>
  );
}
