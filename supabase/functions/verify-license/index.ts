import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { license_key, device_id, app_signature } = await req.json();

    if (!license_key) {
      return new Response(
        JSON.stringify({ status: "invalid", reason: "license_key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ip = req.headers.get("x-forwarded-for") || "unknown";

    // 1. Find license record
    const { data: download, error } = await adminClient
      .from("apk_downloads")
      .select("*")
      .eq("license_key", license_key)
      .single();

    if (error || !download) {
      // Log invalid attempt
      await adminClient.from("license_verification_logs").insert({
        license_key,
        device_id: device_id || null,
        app_signature: app_signature || null,
        result: "invalid",
        reason: "License key not found",
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({ status: "invalid", reason: "License key not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if blocked
    if (download.is_blocked) {
      await adminClient.from("license_verification_logs").insert({
        license_key,
        device_id: device_id || null,
        app_signature: app_signature || null,
        user_id: download.user_id,
        result: "blocked",
        reason: download.blocked_reason || "License revoked",
        ip_address: ip,
      });

      return new Response(
        JSON.stringify({ status: "blocked", reason: download.blocked_reason || "License revoked" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Device binding check
    if (device_id) {
      const existingDevice = download.device_info?.device_id;

      if (existingDevice && existingDevice !== device_id) {
        // Already bound to a different device
        await adminClient.from("license_verification_logs").insert({
          license_key,
          device_id,
          app_signature: app_signature || null,
          user_id: download.user_id,
          result: "wrong_device",
          reason: `Bound to device ${existingDevice.substring(0, 8)}..., attempted from ${device_id.substring(0, 8)}...`,
          ip_address: ip,
        });

        return new Response(
          JSON.stringify({
            status: "invalid",
            reason: "License is bound to a different device. Contact support.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Bind device on first use
      if (!existingDevice) {
        await adminClient
          .from("apk_downloads")
          .update({
            device_info: { device_id, app_signature: app_signature || null, bound_at: new Date().toISOString() },
            verification_attempts: (download.verification_attempts || 0) + 1,
          })
          .eq("id", download.id);
      } else {
        // Same device, just update attempts
        await adminClient
          .from("apk_downloads")
          .update({
            verification_attempts: (download.verification_attempts || 0) + 1,
          })
          .eq("id", download.id);
      }
    }

    // 4. Log valid verification
    await adminClient.from("license_verification_logs").insert({
      license_key,
      device_id: device_id || null,
      app_signature: app_signature || null,
      user_id: download.user_id,
      result: "valid",
      reason: "License verified successfully",
      ip_address: ip,
    });

    return new Response(
      JSON.stringify({
        status: "valid",
        user_id: download.user_id,
        product_id: download.product_id,
        bound_device: download.device_info?.device_id || device_id || null,
        verified_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ status: "error", reason: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
