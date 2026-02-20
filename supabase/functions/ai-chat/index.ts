import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `You are VALA AI, an advanced internal assistant for the SaaS VALA platform by SoftwareVala™.

## Core Capabilities
- **Source Code Analysis**: Upload any size ZIP, PHP, JS, Python, or mixed projects
- **AI-Powered Code Fixing**: Auto-detect bugs, security issues, and performance problems
- **One-Click Deployment**: Deploy to servers without developer knowledge
- **Addon Integration**: Payment gateways, wallet systems, language packs
- **Security Scanning**: Real-time threat detection and auto-fix
- **License Management**: Generate, validate, and manage software licenses

## Response Guidelines
1. Be precise and accurate - verify information before responding
2. Use proper code formatting with syntax highlighting
3. Provide step-by-step instructions for complex tasks
4. Include error handling and edge cases in code examples
5. Always explain the "why" behind recommendations
6. Use markdown tables for structured data
7. Break complex answers into clear sections

Powered by SoftwareVala™ Technology | Enterprise Grade AI`;

// ─── OpenAI Direct (Server-Side Only) ────────────────────────────────────────
async function callOpenAI(messages: Message[], model: string, stream: boolean, apiKey: string) {
  // Map display model names to real OpenAI model IDs
  const modelMap: Record<string, string> = {
    'openai/gpt-5':        'gpt-4o',
    'openai/gpt-5-mini':   'gpt-4o-mini',
    'openai/gpt-5.2':      'gpt-4o',
    'gpt-4o':              'gpt-4o',
    'gpt-4o-mini':         'gpt-4o-mini',
  };
  const openaiModel = modelMap[model] ?? (model.startsWith('gpt-') ? model : 'gpt-4o-mini');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: openaiModel,
      messages,
      max_tokens: 8192,
      temperature: 0.3,
      stream,
    }),
  });

  return { response, provider: 'openai', modelUsed: openaiModel };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, stream = false, model = 'gpt-4o-mini', diagnostic = false } = body as {
      messages: Message[];
      stream?: boolean;
      model?: string;
      diagnostic?: boolean;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

    if (!OPENAI_API_KEY) {
      console.error('[VALA AI] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to secrets.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allMessages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    // ─── BOOT DIAGNOSTICS ─────────────────────────────────────────────────────
    if (diagnostic) {
      console.log('═══════════════════════════════════════════');
      console.log('VALA AI — SYSTEM DIAGNOSTIC');
      console.log('═══════════════════════════════════════════');
      console.log(`Active Model       : ${model}`);
      console.log(`API Base URL       : https://api.openai.com/v1`);
      console.log(`OPENAI_API_KEY     : ${OPENAI_API_KEY.length > 0 ? 'PRESENT' : 'MISSING'}`);
      console.log(`Key (last 4 chars) : ...${OPENAI_API_KEY.slice(-4)}`);
      console.log(`Environment        : PRODUCTION`);
      console.log(`Provider           : OpenAI Direct (no fallback)`);
      console.log(`Stream Mode        : ${stream}`);
      console.log('═══════════════════════════════════════════');
    }

    // ─── CALL OPENAI ──────────────────────────────────────────────────────────
    console.log(`[VALA AI] Calling OpenAI | model: ${model} | stream: ${stream}`);
    let result: { response: Response; provider: string; modelUsed: string };

    try {
      result = await callOpenAI(allMessages, model, stream, OPENAI_API_KEY);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[VALA AI] OpenAI request failed:', msg);
      return new Response(
        JSON.stringify({ error: `OpenAI request failed: ${msg}` }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!result.response.ok) {
      const errText = await result.response.text();
      console.error(`[VALA AI] OpenAI error [${result.response.status}]: ${errText}`);

      // Surface specific error codes clearly
      if (result.response.status === 401) {
        return new Response(
          JSON.stringify({ error: '❌ 401 Invalid API Key — Update OPENAI_API_KEY in secrets.', code: 401, type: 'invalid_api_key' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (result.response.status === 403) {
        return new Response(
          JSON.stringify({ error: '❌ 403 Permission Denied — Check OpenAI organization/project permissions.', code: 403, type: 'permission_denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (result.response.status === 429) {
        return new Response(
          JSON.stringify({ error: '⚠️ 429 Rate Limited — OpenAI rate limit hit. Wait and retry.', code: 429, type: 'rate_limit' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (result.response.status === 402) {
        return new Response(
          JSON.stringify({ error: '💳 402 Billing Issue — Add credits to your OpenAI account.', code: 402, type: 'billing' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (result.response.status >= 500) {
        return new Response(
          JSON.stringify({ error: `🔴 ${result.response.status} OpenAI Server Error — Retry later.`, code: result.response.status, type: 'server_error' }),
          { status: result.response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: errText }),
        { status: result.response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── STREAMING RESPONSE ───────────────────────────────────────────────────
    if (stream) {
      console.log(`[VALA AI] ✅ Streaming | model: ${result.modelUsed}`);
      return new Response(result.response.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'X-AI-Provider': result.provider,
          'X-AI-Model': result.modelUsed,
        },
      });
    }

    // ─── NON-STREAMING RESPONSE ───────────────────────────────────────────────
    const data = await result.response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error('[VALA AI] Empty response from OpenAI');
      return new Response(
        JSON.stringify({ error: 'OpenAI returned empty response. Please retry.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VALA AI] ✅ Success | model: ${result.modelUsed} | tokens: ${data.usage?.total_tokens ?? 'N/A'}`);

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        model: result.modelUsed,
        provider: result.provider,
        usage: data.usage,
        ...(diagnostic ? {
          _diagnostic: {
            provider_used: 'openai_direct',
            model_requested: model,
            model_used: result.modelUsed,
            api_base: 'https://api.openai.com/v1',
            openai_key_present: OPENAI_API_KEY.length > 0,
            key_last4: OPENAI_API_KEY.slice(-4),
            environment: 'PRODUCTION',
            input_tokens: data.usage?.prompt_tokens,
            output_tokens: data.usage?.completion_tokens,
            total_tokens: data.usage?.total_tokens,
            cors_blocked: false,
            client_side_calls: false,
          }
        } : {})
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VALA AI] Fatal error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
