import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Best available model for accuracy and performance
const AI_MODEL = 'google/gemini-3-flash-preview';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, stream = false } = await req.json() as { messages: Message[]; stream?: boolean };

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please contact admin.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing AI chat: ${messages.length} messages, stream: ${stream}, model: ${AI_MODEL}`);

    // Enhanced system prompt for maximum accuracy
    const systemMessage: Message = {
      role: 'system',
      content: `You are SaaS VALA AI, an advanced internal assistant for the SaaS VALA platform by SoftwareVala™.

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

## Code Quality Standards
- Follow best practices for the language being discussed
- Include type annotations where applicable
- Add comments for complex logic
- Consider security implications
- Optimize for performance

Powered by SoftwareVala™ Technology | Enterprise Grade AI`
    };

    const allMessages = [systemMessage, ...messages];

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: allMessages,
        max_completion_tokens: 8192,
        temperature: 0.3,
        stream: stream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI Gateway error [${response.status}]:`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 400) {
        return new Response(
          JSON.stringify({ error: 'Invalid request. Please try again with a different message.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable. Please try again.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Streaming response
    if (stream) {
      console.log('Streaming response started');
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }

    // Non-streaming response
    const data = await response.json();
    console.log('AI response received:', data.usage || 'no usage data');

    const assistantMessage = data.choices?.[0]?.message?.content;
    
    if (!assistantMessage) {
      console.error('No content in AI response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'AI returned empty response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        response: assistantMessage,
        model: AI_MODEL,
        usage: data.usage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('AI chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
