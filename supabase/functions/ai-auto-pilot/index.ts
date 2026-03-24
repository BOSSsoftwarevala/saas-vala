import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    switch (action) {
      case "handle_client_request": {
        // AI processes client request and determines action
        const { requestId, requestType, requestDetails, clientName } = data;

        const systemPrompt = `You are an AI assistant for SoftwareVala. Handle client requests automatically.
        
Available actions you can take:
- Payment Gateway: Integrate Razorpay, Stripe, PayU, Cashfree
- AI API: Setup Lovable AI, OpenAI, Google Gemini integration
- Server: Deploy, configure, or manage servers
- Database: Setup PostgreSQL, MySQL, MongoDB
- Domain: Register, configure DNS, SSL certificates
- Custom: Any other software development task

Respond with JSON:
{
  "action_type": "string (payment_gateway/ai_api/server/database/domain/custom)",
  "action_steps": ["step1", "step2", ...],
  "estimated_cost": number,
  "estimated_time": "string",
  "auto_executable": boolean,
  "response_to_client": "string"
}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Client: ${clientName}\nRequest Type: ${requestType}\nDetails: ${requestDetails}` }
            ],
            tools: [{
              type: "function",
              function: {
                name: "process_request",
                description: "Process and respond to client request",
                parameters: {
                  type: "object",
                  properties: {
                    action_type: { type: "string" },
                    action_steps: { type: "array", items: { type: "string" } },
                    estimated_cost: { type: "number" },
                    estimated_time: { type: "string" },
                    auto_executable: { type: "boolean" },
                    response_to_client: { type: "string" }
                  },
                  required: ["action_type", "action_steps", "estimated_cost", "response_to_client"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "process_request" } }
          }),
        });

        if (!response.ok) {
          throw new Error(`AI Gateway error: ${response.status}`);
        }

        const aiResult = await response.json();
        const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
        let aiAction: Record<string, any> = { action_type: "custom", action_steps: [], estimated_cost: 0, response_to_client: "Processing your request..." };
        
        if (toolCall?.function?.arguments) {
          aiAction = JSON.parse(toolCall.function.arguments);
        }

        // Update client request with AI response
        await supabase
          .from("client_requests")
          .update({
            status: aiAction.auto_executable ? "in_progress" : "pending",
            ai_response: aiAction.response_to_client,
            ai_action_taken: JSON.stringify(aiAction.action_steps),
            estimated_cost: aiAction.estimated_cost,
            updated_at: new Date().toISOString()
          })
          .eq("id", requestId);

        return new Response(JSON.stringify({ success: true, aiAction }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate_daily_software": {
        // Generate 2 new software ideas for marketplace
        const { date } = data;

        const systemPrompt = `You are a software product manager for SoftwareVala marketplace.
Generate 2 unique small business software ideas for India/Africa market. Price: $5 each.

Industries to target: Retail, Food, Education, Healthcare, Transport, Services, Agriculture.

Respond with JSON array of 2 products:
[{
  "name": "SOFTWARE NAME",
  "type": "billing/crm/inventory/booking/management",
  "industry": "string",
  "features": [{"icon": "IconName", "text": "Feature description"}],
  "description": "2-3 sentence description"
}]`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Generate 2 new software products for date: ${date}. Make them unique and useful for small businesses.` }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`AI Gateway error: ${response.status}`);
        }

        const aiResult = await response.json();
        const content = aiResult.choices?.[0]?.message?.content || "[]";
        
        // Parse JSON from response
        let products = [];
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            products = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse AI response:", e);
        }

        // Insert into queue
        for (const product of products) {
          await supabase.from("auto_software_queue").insert({
            software_name: product.name,
            software_type: product.type,
            target_industry: product.industry,
            features: product.features,
            ai_generated_description: product.description,
            scheduled_date: date,
            status: "queued"
          });
        }

        return new Response(JSON.stringify({ success: true, products }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate_seo_backlinks": {
        // Generate SEO meta and backlink opportunities
        const { productId: _productId, productName, productDescription } = data;

        const systemPrompt = `You are an SEO expert. Generate meta tags and backlink opportunities for software products.

Respond with JSON:
{
  "meta_title": "string (max 60 chars)",
  "meta_description": "string (max 160 chars)",
  "keywords": ["keyword1", "keyword2", ...],
  "backlink_opportunities": [
    {
      "type": "directory/guest_post/social/forum",
      "platform": "string",
      "suggested_anchor": "string"
    }
  ],
  "schema_markup": {}
}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Product: ${productName}\nDescription: ${productDescription}\n\nGenerate comprehensive SEO strategy for India and Africa markets.` }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`AI Gateway error: ${response.status}`);
        }

        const aiResult = await response.json();
        const content = aiResult.choices?.[0]?.message?.content || "{}";
        
        let seoData = {};
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            seoData = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("Failed to parse SEO response:", e);
        }

        return new Response(JSON.stringify({ success: true, seoData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check_billing_alerts": {
        // Check for upcoming bills and send alerts
        const today = new Date();
        const fourDaysFromNow = new Date(today);
        fourDaysFromNow.setDate(today.getDate() + 4);
        const oneDayFromNow = new Date(today);
        oneDayFromNow.setDate(today.getDate() + 1);

        // Get bills due in 4 days
        const { data: fourDayBills } = await supabase
          .from("billing_tracker")
          .select("*")
          .eq("status", "active")
          .eq("alert_sent_4_days", false)
          .lte("next_due_date", fourDaysFromNow.toISOString().split("T")[0])
          .gte("next_due_date", today.toISOString().split("T")[0]);

        // Get bills due in 1 day
        const { data: oneDayBills } = await supabase
          .from("billing_tracker")
          .select("*")
          .eq("status", "active")
          .eq("alert_sent_1_day", false)
          .lte("next_due_date", oneDayFromNow.toISOString().split("T")[0])
          .gte("next_due_date", today.toISOString().split("T")[0]);

        const alerts = [];

        // Process 4-day alerts
        for (const bill of fourDayBills || []) {
          alerts.push({
            type: "4_day_warning",
            service: bill.service_name,
            amount: bill.amount,
            due_date: bill.next_due_date,
            message: `⚠️ BILLING ALERT: ${bill.service_name} due in 4 days - $${bill.amount}`
          });

          // Create notification
          await supabase.from("notifications").insert({
            user_id: data.userId || "system",
            title: "⚠️ Billing Alert - 4 Days",
            message: `${bill.service_name} (${bill.service_type}) - $${bill.amount} due on ${bill.next_due_date}`,
            type: "warning"
          });

          // Mark as sent
          await supabase
            .from("billing_tracker")
            .update({ alert_sent_4_days: true })
            .eq("id", bill.id);
        }

        // Process 1-day alerts
        for (const bill of oneDayBills || []) {
          alerts.push({
            type: "1_day_urgent",
            service: bill.service_name,
            amount: bill.amount,
            due_date: bill.next_due_date,
            message: `🚨 URGENT: ${bill.service_name} due TOMORROW - $${bill.amount}`
          });

          await supabase.from("notifications").insert({
            user_id: data.userId || "system",
            title: "🚨 URGENT Billing - Due Tomorrow",
            message: `${bill.service_name} (${bill.service_type}) - $${bill.amount} due TOMORROW!`,
            type: "error"
          });

          await supabase
            .from("billing_tracker")
            .update({ alert_sent_1_day: true })
            .eq("id", bill.id);
        }

        return new Response(JSON.stringify({ success: true, alerts }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("AI Auto-Pilot error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
