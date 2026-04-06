import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!resendApiKey || !lovableApiKey) {
      throw new Error("Missing RESEND_API_KEY or LOVABLE_API_KEY");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const user = userData.user;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Get referral code
    const { data: codeRow } = await adminClient
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!codeRow) throw new Error("No referral code found");

    const { emails } = await req.json();
    if (!Array.isArray(emails) || emails.length === 0) {
      throw new Error("No emails provided");
    }

    // Limit to 10 emails per request
    const validEmails = emails
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .slice(0, 10);

    if (validEmails.length === 0) throw new Error("No valid emails provided");

    const referrerName = user.email?.split("@")[0] || "A contractor";
    const referralLink = `https://ezbid-seven.vercel.app/auth?ref=${codeRow.code}`;

    const results = [];

    for (const email of validEmails) {
      // Create referral row
      await adminClient.from("referrals").insert({
        referrer_user_id: user.id,
        referred_email: email,
        status: "pending",
      });

      // Send email via Resend
      const emailRes = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": resendApiKey,
        },
        body: JSON.stringify({
          from: "EZ-Bid <onboarding@resend.dev>",
          to: [email],
          subject: "You've been invited to try EZ-Bid — get started free",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 30px 20px;">
              <h1 style="font-size: 22px; font-weight: bold; color: #1a1a1a; margin-bottom: 16px;">
                You've been invited to EZ-Bid
              </h1>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 16px;">
                ${referrerName} thinks you'd love EZ-Bid — the AI-powered proposal tool built for trade contractors. 
                Create polished, professional proposals in minutes, not hours.
              </p>
              <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
                Get started with 3 free proposals. No credit card required.
              </p>
              <a href="${referralLink}" style="display: inline-block; background: #1a1a1a; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Get Started Free
              </a>
              <p style="font-size: 12px; color: #999; margin-top: 30px;">
                Sent via EZ-Bid referral program
              </p>
            </div>
          `,
        }),
      });

      results.push({ email, sent: emailRes.ok });
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[send-referral-invite] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
