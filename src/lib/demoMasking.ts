const normalizeEnv = (value: string | undefined): string => (value ?? '').trim().replace(/^['"]|['"]$/g, '');

export const SAAS_VALA_BRAND = {
  name: 'SaaS Vala',
  description: 'SaaS Vala branded software demos and marketplace previews.',
  faviconPath: '/favicon.png',
};

export const DEMO_PUBLIC_HOST = normalizeEnv(import.meta.env.VITE_DEMO_PUBLIC_HOST) || 'demo.saasvala.com';
export const DEMO_PUBLIC_BASE_URL = normalizeEnv(import.meta.env.VITE_DEMO_PUBLIC_BASE_URL) || `https://${DEMO_PUBLIC_HOST}`;
export const DEMO_PROXY_BASE = normalizeEnv(import.meta.env.VITE_DEMO_PROXY_BASE) || '/demo-proxy';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function sanitizeDemoSourceUrl(value: string | null | undefined): string | null {
  const candidate = (value ?? '').trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildStoredMaskedDemoUrl(slug: string): string {
  const safeSlug = encodeURIComponent(slug.trim());
  return `${trimTrailingSlash(DEMO_PUBLIC_BASE_URL)}/${safeSlug}`;
}

export function buildLocalMaskedDemoPath(slug: string): string {
  return `/demo/${encodeURIComponent(slug.trim())}`;
}

export function buildDemoProxyUrl(slug: string): string {
  return `${trimTrailingSlash(DEMO_PROXY_BASE)}/${encodeURIComponent(slug.trim())}`;
}

export function isMaskedDemoUrl(value: string | null | undefined, slug: string | null | undefined): boolean {
  if (!value || !slug) return false;

  try {
    const parsed = new URL(value);
    const expectedPath = `/${encodeURIComponent(slug.trim())}`;
    return parsed.hostname.toLowerCase() === DEMO_PUBLIC_HOST.toLowerCase() && parsed.pathname === expectedPath;
  } catch {
    return false;
  }
}

export function normalizeDemoUrlPair(slug: string | null | undefined, rawDemoUrl: string | null | undefined) {
  const normalizedSlug = (slug ?? '').trim();
  const sourceUrl = sanitizeDemoSourceUrl(rawDemoUrl);

  if (!normalizedSlug || !sourceUrl) {
    return {
      demoUrl: null,
      demoSourceUrl: null,
    };
  }

  return {
    demoUrl: buildStoredMaskedDemoUrl(normalizedSlug),
    demoSourceUrl: sourceUrl,
  };
}

export function resolveMaskedDemoUrl(product: { slug?: string | null; demo_url?: string | null; demo_enabled?: boolean | null }): string | null {
  if (!product.demo_enabled || !product.slug) return null;
  return isMaskedDemoUrl(product.demo_url, product.slug) ? product.demo_url ?? null : null;
}

export function applySaasValaBranding(title = SAAS_VALA_BRAND.name, description = SAAS_VALA_BRAND.description) {
  if (typeof document === 'undefined') return;

  document.title = title;

  const upsertMeta = (selector: string, attrs: Record<string, string>) => {
    let element = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!element) {
      element = document.createElement('meta');
      document.head.appendChild(element);
    }

    Object.entries(attrs).forEach(([key, value]) => {
      element?.setAttribute(key, value);
    });
  };

  const upsertLink = (selector: string, rel: string, href: string) => {
    let element = document.head.querySelector(selector) as HTMLLinkElement | null;
    if (!element) {
      element = document.createElement('link');
      document.head.appendChild(element);
    }

    element.rel = rel;
    element.href = href;
  };

  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[name="author"]', { name: 'author', content: SAAS_VALA_BRAND.name });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  upsertLink('link[rel="icon"]', 'icon', SAAS_VALA_BRAND.faviconPath);
  upsertLink('link[rel="apple-touch-icon"]', 'apple-touch-icon', SAAS_VALA_BRAND.faviconPath);
}
