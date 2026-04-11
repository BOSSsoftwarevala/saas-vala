import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import {
  applySaasValaBranding,
  buildDemoProxyUrl,
  isMaskedDemoUrl,
  SAAS_VALA_BRAND,
} from '@/lib/demoMasking';

export default function DemoPage() {
  const { slug, demoSlug } = useParams<{ slug?: string; demoSlug?: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedSlug = demoSlug || slug;

  useEffect(() => {
    applySaasValaBranding(`${SAAS_VALA_BRAND.name} Demo`, 'Secure branded demo preview powered by SaaS Vala.');

    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedCombo = event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key);
      const blockedShortcut = event.ctrlKey && ['u', 's'].includes(key);
      if (event.key === 'F12' || blockedCombo || blockedShortcut) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!requestedSlug) return;

    const fetchDemoProduct = async () => {
      setLoading(true);
      try {
        const query = supabase
          .from('products')
          .select('id, name, slug, demo_url, demo_source_url, demo_enabled');

        const { data, error } = /^[0-9a-f-]{36}$/i.test(requestedSlug)
          ? await query.eq('id', requestedSlug).single()
          : await query.eq('slug', requestedSlug).single();

        if (error || !data) {
          console.error('Demo fetch error:', error);
          setError('Demo not available for this product.');
          setLoading(false);
          return;
        }

        setProduct(data);
        const isConfigured = Boolean(
          data.demo_enabled &&
          data.demo_source_url &&
          isMaskedDemoUrl(data.demo_url, data.slug)
        );

        if (!isConfigured) {
          setError('Demo is blocked until SaaS Vala masking is fully configured.');
          setProxyUrl(null);
          return;
        }

        setProxyUrl(buildDemoProxyUrl(data.slug));
      } catch (fetchError) {
        console.error('Demo page failed:', fetchError);
        setError('Failed to load demo.');
      } finally {
        setLoading(false);
      }
    };

    fetchDemoProduct();
  }, [requestedSlug]);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-900/95 p-8 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Marketplace Demo</p>
              <h1 className="text-2xl font-black tracking-tight">{product?.name ?? 'Demo Viewer'}</h1>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-sm leading-6">
            {loading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading demo details…</span>
              </div>
            ) : error ? (
              <p className="text-foreground/80">{error}</p>
            ) : proxyUrl ? (
              <>
                <p className="mb-4">Demo is running inside the SaaS Vala secure preview container.</p>
                <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <iframe
                    key={frameKey}
                    src={proxyUrl}
                    title={`${product?.name ?? SAAS_VALA_BRAND.name} Demo`}
                    className="h-[70vh] w-full border-0"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button className="gap-2" onClick={() => setFrameKey((current) => current + 1)}>
                    <ExternalLink className="h-4 w-4" /> Reload Demo
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => navigate('/marketplace')}>
                    Back to Marketplace
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4">Demo not available for this product.</p>
                <Button className="gap-2" onClick={() => navigate('/marketplace')}>
                  Back to Marketplace
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
