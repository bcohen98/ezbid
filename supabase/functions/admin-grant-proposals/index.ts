import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, grant_count } = await req.json();
    if (!target_user_id || typeof grant_count !== "number" || grant_count < 1 || grant_count > 20) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current bonus
    const { data: sub, error: subError } = await adminClient
      .from("user_subscriptions")
      .select("bonus_proposals")
      .eq("user_id", target_user_id)
      .single();

    if (subError || !sub) {
      return new Response(JSON.stringify({ error: "User subscription not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newTotal = (sub.bonus_proposals || 0) + grant_count;

    const { error: updateError } = await adminClient
      .from("user_subscriptions")
      .update({ bonus_proposals: newTotal })
      .eq("user_id", target_user_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email notification to the user
    try {
      const { data: targetProfile } = await adminClient
        .from("company_profiles")
        .select("email, owner_name")
        .eq("user_id", target_user_id)
        .single();

      if (targetProfile?.email) {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const firstName = targetProfile.owner_name?.trim().split(/\s+/)[0] || "there";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: "EZ-Bid <brett@ezbid.pro>",
              to: [targetProfile.email],
              subject: `you got ${grant_count} free proposals on EZ-Bid`,
              text: `Hey ${firstName} —\n\nGood news — I just added ${grant_count} extra free proposals to your EZ-Bid account. You now have ${newTotal} bonus proposals on top of the standard 3.\n\nGo ahead and put them to use whenever you're ready.\n\n— Brett\n\nCreate a Proposal → https://ezbid.pro/new-proposal`,
              reply_to: "brett@ezbid.pro",
            }),
          });
          console.log(`[admin-grant] Sent notification email to ${targetProfile.email}`);
        }
      }
    } catch (emailErr) {
      console.error("[admin-grant] Email notification failed:", emailErr);
      // Don't fail the grant if email fails
    }

    return new Response(JSON.stringify({ success: true, new_total: newTotal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-grant-proposals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
