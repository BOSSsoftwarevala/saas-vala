import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function DemoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDemoProduct = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, demo_url')
          .eq('id', id)
          .single();

        if (error || !data) {
          console.error('Demo fetch error:', error);
          setError('Demo not available for this product.');
          setLoading(false);
          return;
        }

        setProduct(data);
        const url = data.demo_url || null;
        setDemoUrl(url);

        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch (fetchError) {
        console.error('Demo page failed:', fetchError);
        setError('Failed to load demo.');
      } finally {
        setLoading(false);
      }
    };

    fetchDemoProduct();
  }, [id]);

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
            ) : demoUrl ? (
              <>
                <p className="mb-4">Demo is launching in a new tab.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button className="gap-2" onClick={() => window.open(demoUrl, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink className="h-4 w-4" /> Open Demo Again
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
