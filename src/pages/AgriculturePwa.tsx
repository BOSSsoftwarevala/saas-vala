import { useState, useEffect, useMemo, useCallback } from 'react';
import { SectionSlider } from '@/components/marketplace/SectionSlider';
import { SectionHeader } from '@/components/marketplace/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Star, ExternalLink, Download, KeyRound, CheckCircle2, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { validateLicenseKeyInDb } from '@/lib/licenseUtils';
import { cn } from '@/lib/utils';

const PRODUCTS = [
  { id: 'agri-pwa-1', name: 'FarmERP Clone', repo: 'https://github.com/saasvala/farmerp-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Farm management with crop monitoring and livestock tracking.', features: ['Farm Management', 'Crop Monitoring', 'Livestock Tracking', 'Analytics Dashboard', 'Mobile App'] },
  { id: 'agri-pwa-2', name: 'DairyManager Clone', repo: 'https://github.com/saasvala/dairymanager-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Milk collection tracking with livestock and inventory management.', features: ['Milk Collection Tracking', 'Livestock Management', 'Inventory Management', 'Analytics Dashboard', 'Mobile App'] },
  { id: 'agri-pwa-3', name: 'AgriTech Clone', repo: 'https://github.com/saasvala/agritech-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Crop planning with irrigation monitoring and soil analysis.', features: ['Crop Planning', 'Irrigation Monitoring', 'Soil Analysis', 'Analytics Dashboard', 'Mobile App'] },
  { id: 'agri-pwa-4', name: 'FishFarm Clone', repo: 'https://github.com/saasvala/fishfarm-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Fishery tracking with water quality monitoring and stock management.', features: ['Fishery Tracking', 'Water Quality Monitoring', 'Stock Management', 'Analytics Dashboard', 'Mobile App'] },
  { id: 'agri-pwa-5', name: 'AgroStar Clone', repo: 'https://github.com/saasvala/agrostar-clone-software', price: 5, old_price: 10, rating: 4.9, description: 'Market pricing with inventory management and crop advisory.', features: ['Market Pricing', 'Inventory Management', 'Crop Advisory', 'Mobile App', 'Analytics Dashboard'] },
] as const;

const PFX = 'agri-pwa';

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function AgriculturePwa() {
  const [activated, setActivated] = useState(() => localStorage.getItem(`${PFX}-activated`) === 'true');
  const [wishlist, setWishlist] = useState<string[]>(() => safeJsonParse<string[]>(localStorage.getItem(`${PFX}-wishlist`), []));
  const [showKey, setShowKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    localStorage.setItem(`${PFX}-products`, JSON.stringify(PRODUCTS));
  }, []);

  const wishlistSet = useMemo(() => new Set(wishlist), [wishlist]);

  const toggleWish = useCallback((id: string) => {
    setWishlist(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(`${PFX}-wishlist`, JSON.stringify(next));
      toast.success(next.includes(id) ? 'Added to wishlist' : 'Removed from wishlist');
      return next;
    });
  }, []);

  const activate = useCallback(async () => {
    const trimmed = keyInput.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Enter a license key.');
      return;
    }

    setActivating(true);
    try {
      const result = await validateLicenseKeyInDb(trimmed);

      if (result.valid) {
        setActivated(true);
        localStorage.setItem(`${PFX}-activated`, 'true');
        setShowKey(false);
        setKeyInput('');
        toast.success('🎉 License activated! All 5 Agriculture, Dairy & Fisheries software demos unlocked.');
      } else {
        toast.error(result.error || 'Invalid license key.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Activation failed.');
    } finally {
      setActivating(false);
    }
  }, [keyInput]);

  const download = useCallback(() => {
    if (!activated) {
      setShowKey(true);
      return;
    }

    const payload = {
      bundle: 'SaaS VALA Agriculture, Dairy & Fisheries Master Copy',
      version: '2026.1',
      activated: true,
      products: PRODUCTS.map(p => ({ name: p.name, repo: p.repo, features: p.features })),
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'saas-vala-agriculture-master-copy.json';
    a.click();
    URL.revokeObjectURL(u);
    toast.success('Master Copy downloaded!');
  }, [activated]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">SaaS VALA</h1>
          <p className="text-xs text-muted-foreground">Agriculture, Dairy & Fisheries — Offline PWA</p>
        </div>
        {activated ? (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
            <ShieldCheck className="h-3 w-3" /> Licensed
          </Badge>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowKey(true)} className="gap-1 text-xs">
            <KeyRound className="h-3 w-3" /> Activate
          </Button>
        )}
      </header>

      <main className="py-6 space-y-6">
        {!activated && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-sm">Activate to unlock all 5 Agriculture, Dairy & Fisheries Software Demos</p>
                <p className="text-xs text-muted-foreground">Enter license key: AGRI-PWA-2026-001</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowKey(true)} className="gap-1">
              <KeyRound className="h-3 w-3" /> Enter Key
            </Button>
          </div>
        )}

        {activated && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-semibold text-sm">Master Copy Ready — All 5 Agriculture Software Unlocked</p>
                <p className="text-xs text-muted-foreground">Download the complete offline bundle</p>
              </div>
            </div>
            <Button size="sm" onClick={download} className="gap-1 bg-green-600 hover:bg-green-700 text-white">
              <Download className="h-3 w-3" /> Download Master Copy
            </Button>
          </div>
        )}

        <SectionHeader
          icon="🌾"
          title="Agriculture, Dairy & Fisheries"
          subtitle="Top 5 Agriculture, Dairy & Fisheries Software Clones — Offline Ready."
          badge="ROW 19"
          badgeVariant="hot"
          totalCount={5}
        />

        <SectionSlider>
          {PRODUCTS.map((p, i) => (
            <div key={p.id} className="min-w-[280px] max-w-[320px] flex-shrink-0 group">
              <Card className="relative overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                <div className="absolute top-2 left-2 z-10">
                  <Badge className="bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5">#{i + 1}</Badge>
                </div>

                <div className="absolute top-2 right-2 z-10">
                  <Badge className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 animate-pulse">LIVE DEMO</Badge>
                </div>

                <button type="button" onClick={() => toggleWish(p.id)} className="absolute top-10 right-2 z-10" aria-label="Toggle wishlist">
                  <Heart
                    className={cn(
                      'h-4 w-4 transition-colors',
                      wishlistSet.has(p.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400'
                    )}
                  />
                </button>

                <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center">
                  <div className="w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-3xl">
                    🌾
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest text-primary border-primary/30">Agriculture</Badge>
                  <h3 className="font-bold text-sm leading-tight line-clamp-2 uppercase tracking-tight">{p.name}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</p>

                  <div className="flex flex-wrap gap-1">
                    {p.features.slice(0, 4).map(f => (
                      <Badge key={f} variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">{f}</Badge>
                    ))}
                    {p.features.length > 4 && (
                      <Badge variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">+{p.features.length - 4}</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">${p.old_price}</span>
                    <span className="text-lg font-black text-primary">${p.price}</span>
                    <Badge className="bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0">90% OFF</Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-xs font-semibold">{p.rating}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs gap-1"
                      type="button"
                      onClick={() => window.open(p.repo, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-3 w-3" /> DEMO
                    </Button>

                    <Button
                      size="sm"
                      className="flex-1 text-xs gap-1"
                      type="button"
                      onClick={() => activated ? toast.success('Already unlocked!') : setShowKey(true)}
                    >
                      {activated ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> UNLOCKED
                        </>
                      ) : (
                        <>
                          <KeyRound className="h-3 w-3" /> BUY ${p.price}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </SectionSlider>
      </main>

      <Dialog open={showKey} onOpenChange={setShowKey}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> License Key Activation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Enter your license key to unlock all 5 Agriculture, Dairy & Fisheries software demos offline.</p>
            <Input
              placeholder="AGRI-PWA-2026-001"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                void activate();
              }}
              className="font-mono text-center tracking-widest"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button onClick={() => void activate()} disabled={activating} className="w-full gap-2">
              {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Activate License
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">Keys are validated offline. No internet required.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
