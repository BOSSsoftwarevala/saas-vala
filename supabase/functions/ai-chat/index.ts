import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SYSTEM_PROMPT = `You are SaaS VALA AI, an advanced internal assistant for the SaaS VALA platform by SoftwareVala™.

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

// ─── PROVIDER 1: OpenAI Direct ───────────────────────────────────────────────
async function callOpenAI(messages: Message[], model: string, stream: boolean, apiKey: string) {
  const modelMap: Record<string, string> = {
    'openai/gpt-5': 'gpt-4o',
    'openai/gpt-5-mini': 'gpt-4o-mini',
    'google/gemini-3-flash-preview': 'gpt-4o-mini',
    'google/gemini-2.5-flash': 'gpt-4o-mini',
    'google/gemini-2.5-pro': 'gpt-4o',
    'openai/gpt-5.2': 'gpt-4o',
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

// ─── PROVIDER 2: Lovable AI Gateway (fallback) ────────────────────────────────
async function callLovableAI(messages: Message[], model: string, stream: boolean, apiKey: string) {
  const lovableModel = (model && model.startsWith('google/')) ? model : 'google/gemini-3-flash-preview';

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: lovableModel,
      messages,
      max_tokens: 8192,
      temperature: 0.3,
      stream,
    }),
  });

  return { response, provider: 'lovable', modelUsed: lovableModel };
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';

    const allMessages: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ];

    let result: { response: Response; provider: string; modelUsed: string } | null = null;
    let lastError = '';

    // ─── TRY OPENAI FIRST ─────────────────────────────────────────────────────
    if (OPENAI_API_KEY) {
      console.log('[AI] Trying OpenAI (primary)...');
      try {
        result = await callOpenAI(allMessages, model, stream, OPENAI_API_KEY);
        if (!result.response.ok) {
          const errText = await result.response.text();
          console.warn(`[AI] OpenAI failed [${result.response.status}]: ${errText}`);
          lastError = `OpenAI ${result.response.status}: ${errText}`;

          // Don't fallback on 401 (bad key) — surface immediately
          if (result.response.status === 401) {
            return new Response(
              JSON.stringify({ error: 'OpenAI API key is invalid. Please update OPENAI_API_KEY secret.' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          result = null; // trigger fallback
        }
      } catch (e) {
        lastError = String(e);
        console.warn('[AI] OpenAI threw exception:', lastError);
        result = null;
      }
    } else {
      console.warn('[AI] OPENAI_API_KEY not set — skipping OpenAI');
    }

    // ─── FALLBACK: LOVABLE AI ─────────────────────────────────────────────────
    if (!result && LOVABLE_API_KEY) {
      console.log('[AI] Falling back to Lovable AI Gateway...');
      try {
        result = await callLovableAI(allMessages, model, stream, LOVABLE_API_KEY);
        if (!result.response.ok) {
          const errText = await result.response.text();
          console.error(`[AI] Lovable AI also failed [${result.response.status}]: ${errText}`);

          if (result.response.status === 402) {
            return new Response(
              JSON.stringify({ error: 'AI credits depleted on both providers. Please top up OpenAI or Lovable credits.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (result.response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded on both providers. Please wait a moment.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          result = null;
        }
      } catch (e) {
        console.error('[AI] Lovable AI threw exception:', String(e));
        result = null;
      }
    }

    // ─── BOTH FAILED ──────────────────────────────────────────────────────────
    if (!result) {
      console.error('[AI] All providers failed. Last error:', lastError);
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable. Both providers failed. Please try again.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── STREAMING RESPONSE ───────────────────────────────────────────────────
    if (stream) {
      console.log(`[AI] Streaming via ${result.provider} | model: ${result.modelUsed}`);
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
      console.error('[AI] Empty response from provider:', result.provider);
      return new Response(
        JSON.stringify({ error: 'AI returned empty response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI] ✅ Success via ${result.provider} | model: ${result.modelUsed} | tokens: ${data.usage?.total_tokens ?? 'N/A'}`);

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        model: result.modelUsed,
        provider: result.provider,
        usage: data.usage,
        ...(diagnostic ? {
          _diagnostic: {
            provider_used: result.provider,
            model_requested: model,
            model_used: result.modelUsed,
            openai_key_present: OPENAI_API_KEY.length > 0,
            lovable_key_present: LOVABLE_API_KEY.length > 0,
            input_tokens: data.usage?.prompt_tokens,
            output_tokens: data.usage?.completion_tokens,
            total_tokens: data.usage?.total_tokens,
          }
        } : {})
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI] Fatal error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
