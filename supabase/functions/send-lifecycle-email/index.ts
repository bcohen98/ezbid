import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API = "https://api.resend.com/emails";
const FROM = "Brett <brett@ezbid.pro>";

interface EmailRequest {
  email_type: "welcome" | "day1_nudge" | "free_limit" | "day10_inactive";
  user_id: string;
  recipient_email: string;
  first_name?: string;
  /** Only needed for free_limit — the checkout URL */
  checkout_url?: string;
}

function getFirstName(name?: string | null): string {
  if (!name || !name.trim()) return "there";
  return name.trim().split(/\s+/)[0];
}

function buildEmail(
  type: string,
  firstName: string,
  unsubUrl: string,
  checkoutUrl?: string
): { subject: string; text: string } {
  const unsub = `\n\n---\nIf you'd rather not hear from me, you can unsubscribe here: ${unsubUrl}`;

  switch (type) {
    case "welcome":
      return {
        subject: "welcome to EZ-Bid",
        text: `Hey ${firstName} —

Just saw you signed up for EZ-Bid. I'm Brett, I built this thing.

It takes about 5 minutes to get your first proposal out. Pick your trade, describe the job in plain english, and let the AI do the rest.

If you get stuck or anything feels confusing just reply to this email. I read every one.

— Brett${unsub}`,
      };

    case "day1_nudge":
      return {
        subject: "did you get a chance to try it?",
        text: `Hey ${firstName} —

Noticed you signed up yesterday but haven't had a chance to run a proposal through yet.

Totally get it — busy schedule. When you're ready it takes less than 5 minutes to get a professional proposal out the door.

If something felt confusing or you hit a wall just reply and let me know. Happy to help.

— Brett

Draft Your First Proposal → https://ezbid.pro/new-proposal${unsub}`,
      };

    case "free_limit":
      return {
        subject: "you've used your last free proposal",
        text: `Hey ${firstName} —

You just used your last free proposal on EZ-Bid.

If it's been useful, the paid plan is $29/month and gives you unlimited proposals. One job won pays for months of the subscription.

If you have any questions before upgrading just reply to this.

— Brett

Upgrade to Unlimited → ${checkoutUrl || "https://ezbid.pro/dashboard"}${unsub}`,
      };

    case "day10_inactive":
      return {
        subject: "everything ok?",
        text: `Hey ${firstName} —

Noticed you haven't been on EZ-Bid in a little while. Just wanted to check in.

If something isn't working right or the product isn't doing what you need, I'd genuinely love to know. Just reply to this.

— Brett

Draft a Proposal → https://ezbid.pro/new-proposal${unsub}`,
      };

    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: EmailRequest = await req.json();
    const { email_type, user_id, recipient_email, first_name, checkout_url } = body;

    if (!email_type || !user_id || !recipient_email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check unsubscribe status
    const { data: unsub } = await supabase
      .from("lifecycle_email_unsubs")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (unsub) {
      console.log(`[send-lifecycle-email] User ${user_id} unsubscribed, skipping ${email_type}`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "unsubscribed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this email type was already sent to this user
    const { data: existing } = await supabase
      .from("lifecycle_email_logs")
      .select("id")
      .eq("user_id", user_id)
      .eq("email_type", email_type)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[send-lifecycle-email] ${email_type} already sent to ${user_id}, skipping`);
      return new Response(
        JSON.stringify({ skipped: true, reason: "already_sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create unsubscribe token
    let unsubToken: string;
    const { data: existingToken } = await supabase
      .from("lifecycle_email_unsubs")
      .select("token")
      .eq("user_id", user_id)
      .maybeSingle();

    // We need a token even for non-unsubscribed users. Store it in a way
    // that doesn't mark them as unsubscribed. We'll use a simple approach:
    // generate a deterministic-ish token from user_id for the unsub link.
    // Actually, let's just create the row on first unsubscribe click.
    // For the URL we'll pass user_id encoded.
    unsubToken = user_id;

    const firstName = getFirstName(first_name);
    const unsubUrl = `https://ezbid.pro/unsubscribe?uid=${user_id}`;
    const email = buildEmail(email_type, firstName, unsubUrl, checkout_url);

    // Send via Resend
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [recipient_email],
        subject: email.subject,
        text: email.text,
        reply_to: "brett@ezbid.pro",
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[send-lifecycle-email] Resend error: ${res.status} ${errBody}`);
      throw new Error(`Resend API error: ${res.status}`);
    }

    // Log the send
    await supabase.from("lifecycle_email_logs").insert({
      user_id,
      email_type,
      recipient_email,
    });

    console.log(`[send-lifecycle-email] Sent ${email_type} to ${recipient_email}`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-lifecycle-email] ERROR:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
