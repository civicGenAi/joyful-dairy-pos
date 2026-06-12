// Supabase Edge Function: send-reminder
// Two modes:
//   * manual: the app calls it with a signed-in user's token to email one
//     customer (or all credit/monthly customers) their current balance;
//   * {"mode":"due"}: the pg_cron job (migration 00008) calls it every morning
//     at 07:00 EAT; it emails every customer whose next_due_date is exactly
//     5 days away or today. De-duped per customer per day, so re-runs and
//     unauthenticated triggers cannot spam anyone.
//
// Deploy + configure (one time, from your machine with the Supabase CLI):
//   supabase functions deploy send-reminder --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="African Joy Dairy <billing@yourdomain.tld>"
// (--no-verify-jwt lets the cron job call it; the manual path still checks
//  the caller's capability before sending anything.)

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "African Joy Dairy <onboarding@resend.dev>";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  type: string;
  outstanding_tzs: number;
  reminders_enabled: boolean;
  suspended: boolean;
  next_due_date: string | null;
}

async function sendEmail(opts: {
  to: string;
  name: string;
  outstanding: number;
  dueDate?: string;
  dueToday?: boolean;
}) {
  const amount = new Intl.NumberFormat("en-TZ").format(opts.outstanding);
  const dueLineSw = opts.dueDate
    ? opts.dueToday
      ? `<p><strong>Leo (${opts.dueDate}) ni siku ya malipo.</strong></p>`
      : `<p>Tarehe ya malipo ni <strong>${opts.dueDate}</strong>, zimebaki siku 5.</p>`
    : "";
  const dueLineEn = opts.dueDate
    ? opts.dueToday
      ? `Your payment is due <strong>today (${opts.dueDate})</strong>.`
      : `Your payment is due on <strong>${opts.dueDate}</strong>, 5 days from now.`
    : "";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [opts.to],
      subject: opts.dueDate
        ? opts.dueToday
          ? `African Joy Dairy: malipo yako yanatakiwa leo, TZS ${amount}`
          : `African Joy Dairy: malipo yako tarehe ${opts.dueDate}, TZS ${amount}`
        : `African Joy Dairy: salio lako ni TZS ${amount}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#1E7C3F">African Joy Dairy</h2>
          <p>Habari ${opts.name},</p>
          <p>Hii ni kumbukumbu ya kirafiki: salio lako la sasa ni
            <strong>TZS ${amount}</strong>.</p>
          ${dueLineSw}
          <p>Tafadhali wasiliana nasi au lipa kupitia njia uliyozoea.
            Asante kwa kuchagua African Joy.</p>
          <hr style="border:none;border-top:1px solid #E6EBE1" />
          <p style="font-size:12px;color:#6B776E">
            Hello ${opts.name}, this is a friendly reminder that your current
            balance is <strong>TZS ${amount}</strong>. ${dueLineEn}
            Thank you for choosing African Joy Dairy, Arusha.</p>
        </div>`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

/** Date in East Africa Time as YYYY-MM-DD, optionally offset by whole days. */
function eatToday(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(now);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));

    // Health-console probe: confirms deployment and configuration, sends nothing.
    if (body.mode === "ping") {
      return new Response(JSON.stringify({ ok: true, hasResendKey: !!RESEND_API_KEY }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY secret is not set");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dueMode = body.mode === "due";

    if (!dueMode) {
      // Manual sends require a signed-in caller who can read customers.
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
      );
      const { data: canRead } = await authClient.rpc("has_cap", { cap: "customers:read" });
      if (!canRead) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const today = eatToday();
    const inFiveDays = eatToday(5);

    let query = admin
      .from("customers")
      .select(
        "id, name, email, type, outstanding_tzs, reminders_enabled, suspended, next_due_date",
      )
      .in("type", ["credit", "monthly"])
      .eq("reminders_enabled", true)
      .eq("suspended", false)
      .neq("email", "")
      .gt("outstanding_tzs", 0);
    if (dueMode) query = query.in("next_due_date", [today, inFiveDays]);
    else if (body.customerId) query = query.eq("id", body.customerId);

    const { data: customers, error } = await query;
    if (error) throw new Error(error.message);

    // De-dupe scheduled sends: one due-reminder per customer per day.
    let alreadySent = new Set<string>();
    if (dueMode) {
      const { data: logs } = await admin
        .from("reminder_logs")
        .select("customer_id")
        .eq("status", "sent")
        .like("detail", "due:%")
        .gte("created_at", `${today}T00:00:00+03:00`);
      alreadySent = new Set((logs ?? []).map((l: { customer_id: string }) => l.customer_id));
    }

    const results: { id: string; status: string }[] = [];
    for (const c of (customers ?? []) as CustomerRow[]) {
      if (dueMode && alreadySent.has(c.id)) continue;
      const dueToday = c.next_due_date === today;
      let status = "sent";
      let detail = dueMode
        ? `due:${c.next_due_date}:${dueToday ? "today" : "5d"} email to ${c.email}`
        : `email to ${c.email}`;
      try {
        await sendEmail({
          to: c.email,
          name: c.name,
          outstanding: Number(c.outstanding_tzs),
          dueDate: dueMode ? (c.next_due_date ?? undefined) : undefined,
          dueToday,
        });
      } catch (e) {
        status = "failed";
        detail = String(e);
      }
      await admin
        .from("reminder_logs")
        .insert({ customer_id: c.id, channel: "email", status, detail });
      results.push({ id: c.id, status });
    }

    return new Response(JSON.stringify({ sent: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
