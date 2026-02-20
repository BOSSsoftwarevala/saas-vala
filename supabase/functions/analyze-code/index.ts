import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { filePath, analysisType = 'full' } = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Code analysis requested by ${user.id} for: ${filePath}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('source-code')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download file for analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For ZIP files, we'll analyze metadata and structure
    // For source files, we analyze the content
    const fileName = filePath.split('/').pop() || '';
    const isZip = fileName.endsWith('.zip');
    
    let codeContent = '';
    let fileInfo = {
      name: fileName,
      size: fileData.size,
      type: isZip ? 'archive' : 'source',
    };

    if (!isZip) {
      // Read text content for source files
      codeContent = await fileData.text();
      // Limit content size for AI
      if (codeContent.length > 50000) {
        codeContent = codeContent.substring(0, 50000) + '\n\n... [TRUNCATED - file too large]';
      }
    }

    // Call AI for analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are a senior code reviewer AI. Analyze source code and provide:
1. **Framework/Language Detection**: Identify the tech stack
2. **Code Quality Score**: Rate 1-10 with explanation
3. **Security Issues**: List any vulnerabilities (SQL injection, XSS, etc.)
4. **Performance Issues**: Identify bottlenecks or inefficiencies
5. **Best Practice Violations**: List anti-patterns and bad practices
6. **Suggestions**: Provide actionable improvements

Be concise but thorough. Focus on critical issues first.`;

    const userPrompt = isZip 
      ? `Analyze this ZIP archive metadata:
File: ${fileInfo.name}
Size: ${(fileInfo.size / 1024 / 1024).toFixed(2)} MB

Since this is a ZIP file, provide general guidance on:
- How to extract and analyze the contents
- What to look for based on common project structures
- General best practices for code review`
      : `Analyze this source code:

**File:** ${fileInfo.name}
**Size:** ${(fileInfo.size / 1024).toFixed(1)} KB

\`\`\`
${codeContent}
\`\`\``;

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'No analysis generated';

    console.log(`Analysis complete for ${fileName}`);

    return new Response(
      JSON.stringify({
        success: true,
        fileInfo,
        analysis,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
