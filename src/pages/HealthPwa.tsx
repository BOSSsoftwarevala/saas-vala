import { useState, useEffect, useCallback } from 'react';
import { SectionSlider } from '@/components/marketplace/SectionSlider';
import { SectionHeader } from '@/components/marketplace/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Heart, Star, ExternalLink, Download, KeyRound, CheckCircle2, Lock, ShieldCheck, AlertTriangle, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PFX = 'health-pwa';

const PRODUCTS = [
  {
    id: 'health-1', name: 'Epic Hospital System Clone',
    repo: 'https://github.com/saasvala/epic-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Enterprise hospital information system with full patient lifecycle management.',
    features: ['Patient Management', 'Appointment Booking', 'Electronic Medical Records', 'Billing System', 'Pharmacy Integration', 'Doctor Dashboard', 'Lab Reports'],
    demoFolder: 'epic-hospital',
  },
  {
    id: 'health-2', name: 'Cerner Health System Clone',
    repo: 'https://github.com/saasvala/cerner-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Comprehensive health IT system for hospitals and clinical workflows.',
    features: ['Patient Management', 'Appointment Booking', 'Electronic Medical Records', 'Billing System', 'Pharmacy Integration', 'Doctor Dashboard', 'Lab Reports'],
    demoFolder: 'cerner-hospital',
  },
  {
    id: 'health-3', name: 'Athenahealth EMR Clone',
    repo: 'https://github.com/saasvala/athenahealth-emr-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Cloud-based EMR and practice management for healthcare providers.',
    features: ['Patient Management', 'Appointment Booking', 'Electronic Medical Records', 'Billing System', 'Pharmacy Integration', 'Doctor Dashboard', 'Lab Reports'],
    demoFolder: 'athenahealth-emr',
  },
  {
    id: 'health-4', name: 'Practo Hospital System Clone',
    repo: 'https://github.com/saasvala/practo-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Full-stack hospital platform for patient care, billing, and doctor management.',
    features: ['Patient Management', 'Appointment Booking', 'Electronic Medical Records', 'Billing System', 'Pharmacy Integration', 'Doctor Dashboard', 'Lab Reports'],
    demoFolder: 'practo-hospital',
  },
  {
    id: 'health-5', name: 'OpenMRS Hospital Clone',
    repo: 'https://github.com/saasvala/openmrs-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    description: 'Open-source medical record system for hospitals and clinics worldwide.',
    features: ['Patient Management', 'Appointment Booking', 'Electronic Medical Records', 'Billing System', 'Pharmacy Integration', 'Doctor Dashboard', 'Lab Reports'],
    demoFolder: 'openmrs-hospital',
  },
];

const VALID_KEYS = ['HEALTH-APK-2026-001', 'HEALTH-APK-2026-002', 'HEALTH-APK-2026-003', 'HEALTH-PWA-2026-001'];

function getLicense(): { key: string; activation: string; expiry: string } | null {
  try { const r = localStorage.getItem(`${PFX}-license`); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveLicense(key: string) {
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  localStorage.setItem(`${PFX}-license`, JSON.stringify({ key, activation: now.toISOString(), expiry: expiry.toISOString() }));
}
function isLicenseValid(): { valid: boolean; expired: boolean; daysLeft: number } {
  const lic = getLicense();
  if (!lic) return { valid: false, expired: false, daysLeft: 0 };
  const diff = new Date(lic.expiry).getTime() - Date.now();
  return { valid: diff > 0, expired: diff <= 0, daysLeft: Math.max(0, Math.ceil(diff / 86400000)) };
}
function getWishlist(): string[] {
  try { return JSON.parse(localStorage.getItem(`${PFX}-wishlist`) || '[]'); } catch { return []; }
}
function setWishlist(ids: string[]) { localStorage.setItem(`${PFX}-wishlist`, JSON.stringify(ids)); }

export default function HealthPwa() {
  const [licStatus, setLicStatus] = useState(isLicenseValid);
  const [wishlist, setWishlistState] = useState<string[]>(getWishlist);
  const [showActivation, setShowActivation] = useState(false);
  const [showDemo, setShowDemo] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');

  useEffect(() => { localStorage.setItem(`${PFX}-products`, JSON.stringify(PRODUCTS)); }, []);
  const refreshLicense = useCallback(() => setLicStatus(isLicenseValid()), []);

  const toggleWishlist = (id: string) => {
    const next = wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id];
    setWishlistState(next); setWishlist(next);
    toast.success(next.includes(id) ? 'Added to wishlist' : 'Removed from wishlist');
  };

  const handleBuy = () => {
    if (licStatus.valid) { toast.success('License active! Use Master Copy to access demos.'); return; }
    setShowActivation(true);
  };

  const handleActivate = () => {
    const trimmed = keyInput.trim().toUpperCase();
    if (VALID_KEYS.includes(trimmed)) {
      saveLicense(trimmed); refreshLicense(); setShowActivation(false); setKeyInput('');
      toast.success('🎉 License activated for 30 days! All 5 Healthcare demos unlocked.');
    } else { toast.error('Invalid license key.'); }
  };

  const handleMasterDownload = () => {
    if (!licStatus.valid) { setShowActivation(true); return; }
    const bundle = { bundle: 'SaaS VALA Healthcare Master Copy', version: '2026.1', license: getLicense(), products: PRODUCTS.map(p => ({ name: p.name, repo: p.repo, demoFolder: p.demoFolder, features: p.features })), generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'saas-vala-healthcare-master-copy.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('Master Copy downloaded!');
  };

  const demoProduct = PRODUCTS.find(p => p.id === showDemo);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 md:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">SaaS VALA</h1>
          <p className="text-xs text-muted-foreground">Healthcare & Medical — Offline APK</p>
        </div>
        <div className="flex items-center gap-2">
          {licStatus.valid ? (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1"><ShieldCheck className="h-3 w-3" /> {licStatus.daysLeft}d left</Badge>
          ) : licStatus.expired ? (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1"><AlertTriangle className="h-3 w-3" /> Expired</Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowActivation(true)} className="gap-1 text-xs"><KeyRound className="h-3 w-3" /> Activate</Button>
          )}
        </div>
      </header>

      <main className="py-6 space-y-6">
        {licStatus.expired && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-destructive" /><div><p className="font-semibold text-sm">License Expired</p><p className="text-xs text-muted-foreground">Re-enter a license key to restore 30-day access.</p></div></div>
            <Button size="sm" variant="destructive" onClick={() => setShowActivation(true)} className="gap-1"><KeyRound className="h-3 w-3" /> Re-Activate</Button>
          </div>
        )}

        {!licStatus.valid && !licStatus.expired && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3"><Lock className="h-5 w-5 text-primary" /><div><p className="font-semibold text-sm">Activate to unlock all 5 Healthcare Software Demos</p><p className="text-xs text-muted-foreground">Enter license key: HEALTH-APK-2026-001</p></div></div>
            <Button size="sm" onClick={() => setShowActivation(true)} className="gap-1"><KeyRound className="h-3 w-3" /> Enter Key</Button>
          </div>
        )}

        {licStatus.valid && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg border border-green-500/30 bg-green-500/5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-500" /><div><p className="font-semibold text-sm">Master Copy Ready — {licStatus.daysLeft} days remaining</p><p className="text-xs text-muted-foreground">Download the complete offline bundle</p></div></div>
            <Button size="sm" onClick={handleMasterDownload} className="gap-1 bg-green-600 hover:bg-green-700 text-white"><Download className="h-3 w-3" /> Download Master Copy</Button>
          </div>
        )}

        <SectionHeader icon="🏥" title="Healthcare & Medical Services" subtitle="Top 5 Healthcare Software Clones — Offline Ready." badge="ROW 06" badgeVariant="hot" totalCount={5} />
        <SectionSlider>
          {PRODUCTS.map((product, i) => (
            <div key={product.id} className="min-w-[280px] max-w-[320px] flex-shrink-0 group">
              <Card className="relative overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]">
                <div className="absolute top-2 left-2 z-10"><Badge className="bg-primary text-primary-foreground text-[10px] font-black px-1.5 py-0.5">#{i + 1}</Badge></div>
                <div className="absolute top-2 right-2 z-10"><Badge className="bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 animate-pulse">LIVE DEMO</Badge></div>
                <button onClick={() => toggleWishlist(product.id)} className="absolute top-10 right-2 z-10">
                  <Heart className={cn('h-4 w-4 transition-colors', wishlist.includes(product.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400')} />
                </button>
                <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center">
                  <div className="w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-3xl">🏥</div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest text-primary border-primary/30">Healthcare</Badge>
                  <h3 className="font-bold text-sm leading-tight line-clamp-2 uppercase tracking-tight">{product.name}</h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{product.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {product.features.slice(0, 4).map(f => (<Badge key={f} variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">{f}</Badge>))}
                    {product.features.length > 4 && <Badge variant="secondary" className="text-[8px] px-1.5 py-0 font-medium">+{product.features.length - 4}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground line-through">${product.old_price}</span>
                    <span className="text-lg font-black text-primary">${product.price}</span>
                    <Badge className="bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0">90% OFF</Badge>
                  </div>
                  <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /><span className="text-xs font-semibold">{product.rating}</span></div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => window.open(product.repo, '_blank')}><ExternalLink className="h-3 w-3" /> DEMO</Button>
                    <Button size="sm" className="flex-1 text-xs gap-1" onClick={handleBuy}>
                      {licStatus.valid ? <CheckCircle2 className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                      {licStatus.valid ? 'UNLOCKED' : `BUY $${product.price}`}
                    </Button>
                  </div>
                  {licStatus.valid && (
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => setShowDemo(product.id)}>
                      <FolderOpen className="h-3 w-3" /> Open Local Demo
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </SectionSlider>
      </main>

      <Dialog open={showActivation} onOpenChange={setShowActivation}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> License Key Activation</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Enter your license key to unlock all 5 Healthcare demos for 30 days.</p>
            <Input placeholder="HEALTH-APK-2026-001" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleActivate()} className="font-mono text-center tracking-widest" />
            <Button onClick={handleActivate} className="w-full gap-2"><ShieldCheck className="h-4 w-4" /> Activate License</Button>
            <p className="text-[10px] text-center text-muted-foreground">Keys validated offline. 30-day access from activation.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDemo} onOpenChange={() => setShowDemo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5 text-green-500" /> {demoProduct?.name} — Local Demo</DialogTitle></DialogHeader>
          {demoProduct && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground mb-2 font-mono">/demo/{demoProduct.demoFolder}/demo.html</p>
                <div className="bg-background rounded p-4 border border-border space-y-3">
                  <h2 className="text-lg font-bold text-primary">{demoProduct.name}</h2>
                  <p className="text-sm text-muted-foreground">{demoProduct.description}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {demoProduct.features.map(f => (<div key={f} className="flex items-center gap-1.5 text-xs"><CheckCircle2 className="h-3 w-3 text-green-500" /><span>{f}</span></div>))}
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">✅ Running from local /demo folder — 100% Offline</Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs gap-1" onClick={() => window.open(demoProduct.repo, '_blank')}><ExternalLink className="h-3 w-3" /> View on GitHub</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
