import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tool_id, tool_name, target_url, tool_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (tool_type === "seo") {
      switch (tool_id) {
        case "keyword-research":
          systemPrompt = "You are an expert SEO keyword researcher. Analyze the given website URL and return a JSON object with: {keywords: [{keyword, volume, difficulty, cpc}], summary}";
          userPrompt = `Analyze the website ${target_url} and provide keyword research data. Return realistic keyword suggestions with estimated search volume, difficulty score (1-100), and CPC values.`;
          break;
        case "site-audit":
          systemPrompt = "You are an SEO site auditor. Analyze websites and return a JSON object with: {score, issues: [{type, severity, description, fix}], summary}";
          userPrompt = `Perform a comprehensive SEO audit of ${target_url}. Check for meta tags, headings, mobile-friendliness, page speed issues, and content quality. Return actionable findings.`;
          break;
        case "rank-tracker":
          systemPrompt = "You are a keyword rank tracker. Return a JSON object with: {rankings: [{keyword, position, change, url}], summary}";
          userPrompt = `Analyze likely keyword rankings for ${target_url}. Estimate current Google positions for relevant keywords based on the domain's niche.`;
          break;
        case "backlink-analysis":
          systemPrompt = "You are a backlink analyst. Return a JSON object with: {domain_authority, total_backlinks, referring_domains, top_backlinks: [{source, anchor, authority}], summary}";
          userPrompt = `Analyze the backlink profile of ${target_url}. Estimate domain authority, backlink count, and key linking domains.`;
          break;
        case "competitor-spy":
          systemPrompt = "You are a competitive SEO analyst. Return a JSON object with: {competitors: [{domain, traffic_estimate, top_keywords}], opportunities, summary}";
          userPrompt = `Identify top SEO competitors of ${target_url} and analyze their strategies. Find keyword gaps and opportunities.`;
          break;
        case "content-optimizer":
          systemPrompt = "You are an AI content optimization expert. Return a JSON object with: {content_score, recommendations: [{area, current_state, suggestion, impact}], optimized_meta: {title, description}, summary}";
          userPrompt = `Analyze the content strategy of ${target_url} and provide optimization recommendations for better search rankings.`;
          break;
        default:
          systemPrompt = "You are an SEO expert.";
          userPrompt = `Analyze ${target_url} for SEO.`;
      }
    } else if (tool_type === "lead") {
      systemPrompt = "You are a lead generation strategist. Return a JSON object with: {strategy, target_audience: [{segment, channels, estimated_cpl}], ad_copy: [{headline, description, cta}], budget_breakdown, expected_leads, summary}";
      userPrompt = `Create a comprehensive lead generation strategy for a campaign named "${tool_name}" targeting potential clients. Provide ad copy suggestions, audience targeting, and budget optimization recommendations.`;
    } else {
      throw new Error("Invalid tool type");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Contact admin." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI analysis failed");
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "Analysis complete.";

    return new Response(JSON.stringify({ result: aiContent, tool_id, tool_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reseller-ai-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
