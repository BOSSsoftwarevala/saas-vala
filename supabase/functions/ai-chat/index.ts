import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are VALA AI, an advanced internal assistant for the SaaS VALA platform by SoftwareVala™.

## Core Capabilities
- **Source Code Analysis**: Upload any size ZIP, PHP, JS, Python, or mixed projects
- **AI-Powered Code Fixing**: Auto-detect bugs, security issues, and performance problems
- **One-Click Deployment**: Deploy to servers without developer knowledge
- **License Management**: Generate, validate, and manage software licenses

## Response Guidelines
1. Be precise and accurate
2. Use proper code formatting with syntax highlighting
3. Provide step-by-step instructions for complex tasks
4. Hinglish response preferred. Professional tone.
5. ACTION FIRST → Result → Short summary.

Powered by SoftwareVala™ Technology | VALA AI`;

// ─── Lovable AI Gateway (Google/OpenAI models) ────────────────────────────────
async function callLovableAI(messages: Message[], model: string, temperature: number, maxTokens: number) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VALA AI] Lovable AI error [${response.status}]: ${errText}`);
      return null;
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model: data.model || model,
      provider: 'lovable-ai',
    };
  } catch (e) {
    console.error('[VALA AI] Lovable AI request failed:', e);
    return null;
  }
}

// ─── OpenAI Direct ────────────────────────────────────────────────────────────
async function callOpenAI(messages: Message[], model: string, temperature: number, maxTokens: number) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) return null;

  const modelMap: Record<string, string> = {
    'openai/gpt-5': 'gpt-4o',
    'openai/gpt-5-mini': 'gpt-4o-mini',
    'openai/gpt-5-nano': 'gpt-4o-mini',
    'openai/gpt-5.2': 'gpt-4o',
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
  };
  const openaiModel = modelMap[model] ?? 'gpt-4o-mini';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VALA AI] OpenAI error [${response.status}]: ${errText}`);
      // Return specific error info for billing/auth issues
      if (response.status === 401) throw new Error('❌ OpenAI API Key invalid. Settings check karo.');
      if (response.status === 402) throw new Error('💳 OpenAI credits khatam. Account recharge karo.');
      if (response.status === 429) throw new Error('⏳ Rate limit hit. 30 sec baad retry karo.');
      return null;
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
      model: openaiModel,
      provider: 'openai',
    };
  } catch (e: any) {
    if (e.message?.includes('❌') || e.message?.includes('💳') || e.message?.includes('⏳')) throw e;
    console.error('[VALA AI] OpenAI request failed:', e);
    return null;
  }
}

function isGoogleModel(model: string): boolean {
  return model.startsWith('google/') || model.startsWith('gemini');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let userId: string | null = null;

  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }
  } catch (e) {
    console.warn('[VALA AI] Auth check failed:', e);
  }

  try {
    const body = await req.json();
    const {
      messages,
      model = 'google/gemini-3-flash-preview',
      system_prompt,
      temperature = 0.7,
      max_tokens = 4096,
    } = body as {
      messages: Message[];
      model?: string;
      system_prompt?: string;
      temperature?: number;
      max_tokens?: number;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemMsg = system_prompt || DEFAULT_SYSTEM_PROMPT;
    const allMessages: Message[] = [
      { role: 'system', content: systemMsg },
      ...messages.slice(-10), // Context window limit
    ];

    console.log(`[VALA AI] Request | model: ${model} | msgs: ${allMessages.length} | temp: ${temperature} | user: ${userId || 'anonymous'}`);

    let result: { content: string; usage?: any; model: string; provider: string } | null = null;

    // Route 1: Google models → Lovable AI Gateway
    if (isGoogleModel(model)) {
      result = await callLovableAI(allMessages, model, temperature, max_tokens);
    }

    // Route 2: OpenAI models → Direct OpenAI
    if (!result && !isGoogleModel(model)) {
      result = await callOpenAI(allMessages, model, temperature, max_tokens);
    }

    // Fallback: Try the other provider
    if (!result) {
      console.log('[VALA AI] Primary failed, trying fallback...');
      if (isGoogleModel(model)) {
        result = await callOpenAI(allMessages, 'gpt-4o-mini', temperature, max_tokens);
      } else {
        result = await callLovableAI(allMessages, 'google/gemini-2.5-flash', temperature, max_tokens);
      }
    }

    if (!result || !result.content) {
      return new Response(
        JSON.stringify({ error: 'AI response failed. Koi provider available nahi hai. Check API keys in settings.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VALA AI] ✅ Success | provider: ${result.provider} | model: ${result.model} | tokens: ${result.usage?.total_tokens ?? 'N/A'}`);

    // Track usage for billing
    if (userId && result.usage) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const tokensInput = result.usage.prompt_tokens || 0;
        const tokensOutput = result.usage.completion_tokens || 0;
        const totalTokens = result.usage.total_tokens || 0;

        // Upsert to ai_usage_daily
        await supabaseAdmin
          .from('ai_usage_daily')
          .upsert({
            user_id: userId,
            date: today,
            model: result.model,
            provider: result.provider,
            tokens_input: tokensInput,
            tokens_output: tokensOutput,
            total_tokens: totalTokens,
            requests_count: 1,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,date,model,provider',
            ignoreDuplicates: false
          });

        // If upsert failed due to conflict, increment instead
        const { error: upsertError } = await supabaseAdmin
          .from('ai_usage_daily')
          .select('id,requests_count,total_tokens')
          .eq('user_id', userId)
          .eq('date', today)
          .eq('model', result.model)
          .eq('provider', result.provider)
          .single();

        if (upsertError && upsertError.code === 'PGRST116') {
          // Record exists, increment
          await supabaseAdmin
            .from('ai_usage_daily')
            .update({
              tokens_input: supabaseAdmin.raw(`tokens_input + ${tokensInput}`),
              tokens_output: supabaseAdmin.raw(`tokens_output + ${tokensOutput}`),
              total_tokens: supabaseAdmin.raw(`total_tokens + ${totalTokens}`),
              requests_count: supabaseAdmin.raw(`requests_count + 1`),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('date', today)
            .eq('model', result.model)
            .eq('provider', result.provider);
        }

        console.log(`[VALA AI] Usage tracked for user ${userId}: ${totalTokens} tokens`);
      } catch (trackError) {
        console.warn('[VALA AI] Failed to track usage:', trackError);
        // Don't fail the request if tracking fails
      }
    }

    return new Response(
      JSON.stringify({
        response: result.content,
        model: result.model,
        provider: result.provider,
        usage: result.usage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VALA AI] Error:', msg);
    const status = msg.includes('401') ? 401 : msg.includes('402') ? 402 : msg.includes('429') ? 429 : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});