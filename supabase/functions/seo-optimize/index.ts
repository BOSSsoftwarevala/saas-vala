 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface SeoRequest {
   action: 'generate-meta' | 'analyze-keywords' | 'generate-content' | 'full-optimize';
   content?: string;
   pageName?: string;
   businessType?: string;
   market?: 'india' | 'africa';
   targetCities?: string[];
   language?: 'english' | 'hinglish' | 'simple-english';
 }
 
 // India focus cities
 const INDIA_CITIES = [
   'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
   'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'
 ];
 
 // Africa focus cities
 const AFRICA_CITIES = [
   'Lagos', 'Cairo', 'Johannesburg', 'Nairobi', 'Accra',
   'Cape Town', 'Casablanca', 'Addis Ababa', 'Dar es Salaam', 'Kampala'
 ];
 
 // Trust signals for enterprise positioning
 const TRUST_SIGNALS = [
   'Enterprise-grade security',
   'Pay only when you use',
   'No hidden charges',
   'Bank-level encryption',
   'GDPR compliant',
   'Data privacy guaranteed',
   '24/7 support',
   'Free migration',
   'No vendor lock-in',
   'Trusted by 10,000+ businesses',
 ];
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders });
   }
 
   try {
     const request = await req.json() as SeoRequest;
     const { action, content, pageName, businessType, market = 'india', targetCities, language = 'english' } = request;
 
     const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
     if (!LOVABLE_API_KEY) {
       return new Response(
         JSON.stringify({ error: 'AI service not configured' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const cities = market === 'india' ? INDIA_CITIES : AFRICA_CITIES;
     const targetCity = targetCities?.[0] || cities[0];
     const trustSignal = TRUST_SIGNALS[Math.floor(Math.random() * TRUST_SIGNALS.length)];
 
     let systemPrompt = '';
     let userPrompt = '';
 
     switch (action) {
       case 'generate-meta':
         systemPrompt = `You are an Enterprise SEO expert focused on India and Africa markets.
 Generate SEO-optimized meta tags following these STRICT rules:
 - Title: Under 60 characters, include primary keyword and location
 - Description: Under 160 characters, include CTA and trust signal
 - Keywords: 10-15 long-tail, low-competition keywords with city intent
 - Focus on: LOW cost, HIGH value, Enterprise trust, Pay-when-use model
 - Language: ${language === 'hinglish' ? 'Use simple Hinglish (English with Hindi words)' : 'Simple English for non-native speakers'}
 - Position: $5 software pricing, unique business solution, not common/supermarket software
 - Include local city names: ${cities.slice(0, 5).join(', ')}
 
 Return JSON format:
 {
   "title": "...",
   "description": "...",
   "keywords": ["keyword1", "keyword2", ...],
   "ogTitle": "...",
   "ogDescription": "...",
   "h1": "...",
   "h2Tags": ["...", "..."]
 }`;
         userPrompt = `Generate SEO meta tags for:
 Page: ${pageName || 'Home'}
 Business Type: ${businessType || 'SaaS Software'}
 Market: ${market}
 Target City: ${targetCity}
 
 Content context:
 ${content?.substring(0, 500) || 'General business software landing page'}`;
         break;
 
       case 'analyze-keywords':
         systemPrompt = `You are a keyword research expert for India and Africa markets.
 Analyze and suggest keywords with STRICT focus on:
 - LOW competition keywords only
 - HIGH intent (transactional, commercial)
 - Long-tail keywords (4+ words)
 - Local intent (city + service)
 - Budget-focused ("affordable", "cheap", "free", "low cost")
 - Avoid expensive global keywords
 
 Return JSON format:
 {
   "primaryKeywords": [{"keyword": "...", "competition": "low", "intent": "transactional", "volume": 1000}],
   "secondaryKeywords": [...],
   "localKeywords": [...],
   "avoidKeywords": [...],
   "strategy": "..."
 }`;
         userPrompt = `Analyze keywords for:
 Business: ${businessType || 'Software'}
 Market: ${market}
 Cities: ${cities.slice(0, 5).join(', ')}
 
 Content:
 ${content?.substring(0, 500) || 'Business software solution'}`;
         break;
 
       case 'generate-content':
         systemPrompt = `You are an SEO content writer for India and Africa B2B market.
 Write content following STRICT rules:
 - Simple ${language === 'hinglish' ? 'Hinglish' : 'English'} for non-native speakers
 - Short sentences (max 15 words)
 - Trust-building tone (enterprise safe)
 - NO fake claims or exaggeration
 - Highlight: Pay only when used, No hidden charges, $5 software
 - Include: ${trustSignal}
 - Mention city names for local SEO
 - Human-like readability (Grade 6-8 level)
 - Focus on real business value
 
 Return JSON format:
 {
   "heading": "...",
   "subheading": "...",
   "introduction": "...",
   "features": ["...", "..."],
   "benefits": ["...", "..."],
   "cta": "...",
   "faq": [{"q": "...", "a": "..."}]
 }`;
         userPrompt = `Write SEO content for:
 Page: ${pageName || 'Product'}
 Business: ${businessType || 'Software'}
 Market: ${market}
 City Focus: ${targetCity}`;
         break;
 
       case 'full-optimize':
         systemPrompt = `You are a complete SEO automation engine for India and Africa markets.
 Provide FULL SEO optimization including:
 1. Meta tags (title, description, keywords)
 2. Schema markup (SoftwareApplication JSON-LD)
 3. Content optimization suggestions
 4. Internal linking recommendations
 5. Technical SEO checklist
 
 STRICT RULES:
 - Focus on LOW competition keywords
 - Local intent (city + service)
 - Enterprise trust signals
 - Budget positioning ($5, pay-when-use)
 - NO black-hat techniques
 - Mobile-first, low-bandwidth friendly
 
 Return comprehensive JSON with all optimizations.`;
         userPrompt = `Full SEO optimization for:
 Page: ${pageName || 'Home'}
 Business: ${businessType || 'SaaS'}
 Market: ${market}
 Content: ${content?.substring(0, 1000) || 'Business software solution'}`;
         break;
 
       default:
         return new Response(
           JSON.stringify({ error: 'Invalid action' }),
           { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
         );
     }
 
     console.log(`SEO Optimize: ${action} for ${pageName} in ${market} market`);
 
     const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
     const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error('AI Gateway error:', errorText);
       return new Response(
         JSON.stringify({ error: 'AI service error' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const data = await response.json();
     const aiResponse = data.choices?.[0]?.message?.content;
 
     if (!aiResponse) {
       return new Response(
         JSON.stringify({ error: 'Empty AI response' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     // Try to parse JSON from response
     let result;
     try {
       // Extract JSON from markdown code blocks if present
       const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                         aiResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, aiResponse];
       result = JSON.parse(jsonMatch[1] || aiResponse);
     } catch {
       result = { raw: aiResponse };
     }
 
     return new Response(
       JSON.stringify({
         success: true,
         action,
         market,
         data: result,
         usage: data.usage,
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error: unknown) {
     console.error('SEO optimize error:', error);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });