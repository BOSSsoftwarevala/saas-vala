import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, app_name, repo_url, port, lines } = await req.json();

    const FACTORY_URL = Deno.env.get("FACTORY_URL");
    const FACTORY_TOKEN = Deno.env.get("FACTORY_TOKEN");

    if (!FACTORY_URL || !FACTORY_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "Factory not configured. Set FACTORY_URL and FACTORY_TOKEN." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      "Authorization": `Bearer ${FACTORY_TOKEN}`,
      "Content-Type": "application/json",
    };

    let endpoint = "";
    let method = "POST";
    let body: string | undefined;
    // Deploy gets 5min, everything else 30s
    let timeoutMs = 30000;

    switch (action) {
      case "deploy":
        endpoint = "/deploy";
        body = JSON.stringify({ repo_url, app_name, port });
        timeoutMs = 300000;
        break;
      case "list":
        endpoint = "/apps";
        method = "GET";
        break;
      case "restart":
        endpoint = "/restart";
        body = JSON.stringify({ app_name });
        break;
      case "stop":
        endpoint = "/stop";
        body = JSON.stringify({ app_name });
        break;
      case "delete":
        endpoint = "/delete";
        body = JSON.stringify({ app_name });
        break;
      case "logs":
        endpoint = `/logs/${app_name}?lines=${lines || 50}`;
        method = "GET";
        break;
      case "status":
        endpoint = "/status";
        method = "GET";
        break;
      case "health":
        endpoint = "/health";
        method = "GET";
        timeoutMs = 10000;
        break;
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const url = `${FACTORY_URL.replace(/\/$/, "")}${endpoint}`;
    
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions: RequestInit = { method, headers, signal: controller.signal };
      if (body && method === "POST") fetchOptions.body = body;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);
      const data = await response.json();

      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      
      const isTimeout = fetchError.name === 'AbortError';
      const errorMsg = isTimeout 
        ? `VPS Factory unreachable (timeout ${timeoutMs/1000}s). Check: 1) VPS online at ${FACTORY_URL} 2) Nginx proxy active 3) PM2 vala-factory running`
        : `VPS connection failed: ${fetchError.message}. Run on VPS: pm2 restart vala-factory && sudo systemctl reload nginx`;

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMsg,
          debug: {
            factory_url: FACTORY_URL,
            endpoint,
            timeout_ms: timeoutMs,
            error_type: isTimeout ? 'TIMEOUT' : 'CONNECTION_ERROR'
          }
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
