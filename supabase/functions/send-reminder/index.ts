// Supabase Edge Function: send-reminder
// Sends a balance-reminder email to one customer (or every credit/monthly
// customer with reminders enabled) through Resend, and logs the delivery.
//
// Deploy + configure (one time, from your machine with the Supabase CLI):
//   supabase functions deploy send-reminder
//   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="African Joy Dairy <billing@yourdomain.tld>"
//
// The app calls it with the signed-in user's token; the function checks the
// caller can read customers before sending anything.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
}

async function sendEmail(to: string, name: string, outstanding: number) {
  const amount = new Intl.NumberFormat("en-TZ").format(outstanding);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: `African Joy Dairy: salio lako ni TZS ${amount}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#1E7C3F">African Joy Dairy</h2>
          <p>Habari ${name},</p>
          <p>Hii ni kumbukumbu ya kirafiki: salio lako la sasa ni
            <strong>TZS ${amount}</strong>.</p>
          <p>Tafadhali wasiliana nasi au lipa kupitia njia uliyozoea.
            Asante kwa kuchagua African Joy.</p>
          <hr style="border:none;border-top:1px solid #E6EBE1" />
          <p style="font-size:12px;color:#6B776E">
            Hello ${name}, this is a friendly reminder that your current
            balance is <strong>TZS ${amount}</strong>. Thank you for choosing
            African Joy Dairy, Arusha.</p>
        </div>`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY secret is not set");

    // Caller must be a signed-in user who can read customers.
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    let query = admin
      .from("customers")
      .select("id, name, email, type, outstanding_tzs, reminders_enabled, suspended")
      .in("type", ["credit", "monthly"])
      .eq("reminders_enabled", true)
      .eq("suspended", false)
      .neq("email", "")
      .gt("outstanding_tzs", 0);
    if (body.customerId) query = query.eq("id", body.customerId);

    const { data: customers, error } = await query;
    if (error) throw new Error(error.message);

    const results: { id: string; status: string }[] = [];
    for (const c of (customers ?? []) as CustomerRow[]) {
      let status = "sent";
      let detail = `email to ${c.email}`;
      try {
        await sendEmail(c.email, c.name, Number(c.outstanding_tzs));
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
