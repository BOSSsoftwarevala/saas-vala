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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid auth token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request
    const { product_id, license_key } = await req.json();
    if (!product_id || !license_key) {
      return new Response(
        JSON.stringify({ error: "product_id and license_key required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // 3. Verify license key belongs to this user and product
    const { data: download, error: dlErr } = await adminClient
      .from("apk_downloads")
      .select("*")
      .eq("license_key", license_key)
      .eq("user_id", user.id)
      .eq("product_id", product_id)
      .eq("is_blocked", false)
      .single();

    if (dlErr || !download) {
      return new Response(
        JSON.stringify({ error: "No valid purchase found for this license key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Get product APK URL
    const { data: product, error: prodErr } = await adminClient
      .from("products")
      .select("id, name, apk_url")
      .eq("id", product_id)
      .single();

    if (prodErr || !product || !product.apk_url) {
      return new Response(
        JSON.stringify({ error: "APK file not available for this product" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Generate signed URL (5 min expiry)
    const { data: signedData, error: signErr } = await adminClient.storage
      .from("apks")
      .createSignedUrl(product.apk_url, 300); // 300 seconds = 5 minutes

    if (signErr || !signedData) {
      return new Response(
        JSON.stringify({ error: "Failed to generate download URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Log download
    await adminClient.from("apk_download_logs").insert({
      user_id: user.id,
      product_id: product_id,
      license_key: license_key,
      download_ip: req.headers.get("x-forwarded-for") || "unknown",
      signed_url_expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    // 7. Update download count on product
    await adminClient.rpc("log_activity", {
      p_entity_type: "apk_download",
      p_entity_id: product_id,
      p_action: "apk_downloaded",
      p_details: {
        user_id: user.id,
        license_key,
        product_name: product.name,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        download_url: signedData.signedUrl,
        expires_in: 300,
        product_name: product.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
