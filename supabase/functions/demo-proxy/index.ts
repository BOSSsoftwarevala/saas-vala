import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const demoPublicHost = (Deno.env.get('DEMO_PUBLIC_HOST') ?? 'demo.saasvala.com').trim();
const demoProxyBasePath = (Deno.env.get('DEMO_PROXY_BASE_PATH') ?? '/demo-proxy').replace(/\/+$/, '');
const faviconUrl = (Deno.env.get('DEMO_FAVICON_URL') ?? 'https://saasvala.com/favicon.png').trim();

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type DemoProduct = {
  id: string;
  name: string;
  slug: string;
  demo_enabled: boolean | null;
  demo_url: string | null;
  demo_source_url: string | null;
};

function isHttpUrl(value: string | null | undefined): value is string {
  const raw = (value ?? '').trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildMaskedUrl(slug: string): string {
  return `https://${demoPublicHost}/${encodeURIComponent(slug)}`;
}

function proxyAssetUrl(slug: string, targetUrl: string): string {
  return `${demoProxyBasePath}/${encodeURIComponent(slug)}?asset=${encodeURIComponent(targetUrl)}`;
}

function extractSlug(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const demoProxyIndex = parts.lastIndexOf('demo-proxy');
  if (demoProxyIndex >= 0 && parts[demoProxyIndex + 1]) {
    return decodeURIComponent(parts[demoProxyIndex + 1]);
  }
  return null;
}

function buildHtmlHeaders(cacheSeconds: number): Headers {
  return new Headers({
    ...corsHeaders,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': `public, max-age=${cacheSeconds}, stale-while-revalidate=120`,
    'Content-Security-Policy': "default-src 'self' data: blob: https: http: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' https://saasvala.com https://demo.saasvala.com; base-uri 'self'; form-action 'self' https: http:;",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
}

function filterProxyHeaders(source: Headers, fallbackContentType?: string): Headers {
  const headers = new Headers(corsHeaders);
  const contentType = source.get('content-type') ?? fallbackContentType ?? 'application/octet-stream';

  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', source.get('cache-control') ?? 'public, max-age=600, stale-while-revalidate=120');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');

  return headers;
}

function resolveProxyTarget(rawValue: string, baseUrl: string, slug: string): string | null {
  const candidate = rawValue.trim();
  if (!candidate || candidate.startsWith('#') || candidate.startsWith('javascript:') || candidate.startsWith('mailto:') || candidate.startsWith('tel:') || candidate.startsWith('data:') || candidate.startsWith('blob:')) {
    return null;
  }

  try {
    const absoluteUrl = new URL(candidate, baseUrl).toString();
    return proxyAssetUrl(slug, absoluteUrl);
  } catch {
    return null;
  }
}

function rewriteAttributeReferences(markup: string, baseUrl: string, slug: string): string {
  return markup.replace(/\b(src|href|action|poster)=(["'])(.*?)\2/gi, (fullMatch, attr, quote, value) => {
    const proxied = resolveProxyTarget(value, baseUrl, slug);
    if (!proxied) return fullMatch;
    return `${attr}=${quote}${proxied}${quote}`;
  });
}

function rewriteCssUrls(css: string, baseUrl: string, slug: string): string {
  return css.replace(/url\((['"]?)(.*?)\1\)/gi, (fullMatch, quote, value) => {
    const proxied = resolveProxyTarget(value, baseUrl, slug);
    if (!proxied) return fullMatch;
    return `url(${quote}${proxied}${quote})`;
  });
}

function injectBranding(html: string, product: DemoProduct): string {
  const cleaned = html
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<base[^>]*>/gi, '')
    .replace(/<link[^>]+rel=(["'])[^"']*icon[^"']*\1[^>]*>/gi, '')
    .replace(/<meta[^>]+(?:name|property)=(["'])(description|og:title|og:description|twitter:title|twitter:description|author)\1[^>]*>/gi, '');

  const brandingBlock = `
    <title>SaaS Vala</title>
    <meta name="description" content="SaaS Vala branded demo preview for ${product.name.replace(/"/g, '&quot;')}" />
    <meta name="author" content="SaaS Vala" />
    <meta property="og:title" content="SaaS Vala" />
    <meta property="og:description" content="SaaS Vala branded demo preview" />
    <meta name="twitter:title" content="SaaS Vala" />
    <meta name="twitter:description" content="SaaS Vala branded demo preview" />
    <link rel="icon" href="${faviconUrl}" />
    <link rel="apple-touch-icon" href="${faviconUrl}" />
    <style>
      body::before {
        content: 'SaaS Vala Demo';
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483647;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.86);
        color: #fff;
        font: 600 12px/1.2 Arial, sans-serif;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    </style>
    <script>
      (() => {
        const faviconHref = ${JSON.stringify(faviconUrl)};
        const title = 'SaaS Vala';
        const installBranding = () => {
          document.title = title;
          document.querySelectorAll('a[target="_blank"]').forEach((anchor) => {
            anchor.setAttribute('target', '_self');
            anchor.setAttribute('rel', 'noopener noreferrer');
          });
          document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
          const icon = document.createElement('link');
          icon.rel = 'icon';
          icon.href = faviconHref;
          document.head.appendChild(icon);
        };

        window.open = () => null;
        document.addEventListener('contextmenu', (event) => event.preventDefault(), { passive: false });
        window.addEventListener('keydown', (event) => {
          const key = event.key.toLowerCase();
          const blockedCombo = event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key);
          const blockedShortcut = event.ctrlKey && ['u', 's'].includes(key);
          if (event.key === 'F12' || blockedCombo || blockedShortcut) {
            event.preventDefault();
          }
        });
        document.addEventListener('click', (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const anchor = target.closest('a');
          if (!anchor) return;
          anchor.setAttribute('target', '_self');
        }, true);
        new MutationObserver(installBranding).observe(document.documentElement, { childList: true, subtree: true });
        installBranding();
      })();
    </script>
  `;

  if (cleaned.includes('</head>')) {
    return cleaned.replace('</head>', `${brandingBlock}</head>`);
  }

  return `${brandingBlock}${cleaned}`;
}

async function fetchProduct(slug: string): Promise<DemoProduct | null> {
  const { data, error } = await admin
    .from('products')
    .select('id, name, slug, demo_enabled, demo_url, demo_source_url')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('demo-proxy product lookup failed', error);
    return null;
  }

  return data as DemoProduct | null;
}

async function proxyRequest(targetUrl: string, req: Request): Promise<Response> {
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('Accept', req.headers.get('accept') ?? '*/*');
  upstreamHeaders.set('User-Agent', 'SaaS Vala Demo Proxy/1.0');

  return await fetch(targetUrl, {
    method: 'GET',
    headers: upstreamHeaders,
    redirect: 'follow',
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Proxy is not configured.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const slug = extractSlug(url.pathname) || url.searchParams.get('slug');
  const assetUrl = url.searchParams.get('asset');

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing demo slug.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const product = await fetchProduct(slug);
  if (!product || !product.demo_enabled || !isHttpUrl(product.demo_source_url) || product.demo_url !== buildMaskedUrl(product.slug)) {
    return new Response(JSON.stringify({ error: 'Demo is blocked until masking is configured.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = assetUrl && isHttpUrl(assetUrl) ? assetUrl : product.demo_source_url;
  if (!isHttpUrl(targetUrl)) {
    return new Response(JSON.stringify({ error: 'Invalid demo target.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const upstream = await proxyRequest(targetUrl, req);
    const contentType = upstream.headers.get('content-type') ?? '';

    if (contentType.includes('text/html')) {
      const html = await upstream.text();
      const rewritten = injectBranding(rewriteAttributeReferences(html, targetUrl, product.slug), product);
      return new Response(rewritten, {
        status: upstream.status,
        headers: buildHtmlHeaders(300),
      });
    }

    if (contentType.includes('text/css')) {
      const css = await upstream.text();
      const rewrittenCss = rewriteCssUrls(css, targetUrl, product.slug);
      return new Response(rewrittenCss, {
        status: upstream.status,
        headers: filterProxyHeaders(upstream.headers, 'text/css; charset=utf-8'),
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: filterProxyHeaders(upstream.headers),
    });
  } catch (error) {
    console.error('demo-proxy upstream failure', error);
    return new Response(JSON.stringify({ error: 'Failed to load demo.' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
